import os
import sys
import types
import unittest
from unittest.mock import Mock


os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

# Keep these unit tests dependency-free. Lambda supplies boto3 at runtime, while
# the local web project intentionally does not install Python AWS packages.
class FakeKey:
    def __init__(self, name):
        self.name = name

    def eq(self, value):
        return (self.name, value)


class FakeSerializer:
    def serialize(self, value):
        if value is None:
            return {"NULL": True}
        if isinstance(value, bool):
            return {"BOOL": value}
        if isinstance(value, (int, float)):
            return {"N": str(value)}
        if isinstance(value, dict):
            return {"M": {key: self.serialize(item) for key, item in value.items()}}
        if isinstance(value, list):
            return {"L": [self.serialize(item) for item in value]}
        return {"S": str(value)}


class FakeClientError(Exception):
    def __init__(self, response=None, operation_name=""):
        super().__init__(operation_name)
        self.response = response or {"Error": {}}


boto3_module = types.ModuleType("boto3")
boto3_module.resource = Mock(return_value=Mock(Table=Mock(return_value=Mock())))
boto3_module.client = Mock(return_value=Mock())
conditions_module = types.ModuleType("boto3.dynamodb.conditions")
conditions_module.Key = FakeKey
types_module = types.ModuleType("boto3.dynamodb.types")
types_module.TypeSerializer = FakeSerializer
exceptions_module = types.ModuleType("botocore.exceptions")
exceptions_module.ClientError = FakeClientError

sys.modules.setdefault("boto3", boto3_module)
sys.modules.setdefault("boto3.dynamodb", types.ModuleType("boto3.dynamodb"))
sys.modules.setdefault("boto3.dynamodb.conditions", conditions_module)
sys.modules.setdefault("boto3.dynamodb.types", types_module)
sys.modules.setdefault("botocore", types.ModuleType("botocore"))
sys.modules.setdefault("botocore.exceptions", exceptions_module)

import lambda_function as moderation


def event(method, path, *, body=None, user_id="reporter-1", groups=None, path_parameters=None):
    claims = {"sub": user_id}
    if groups is not None:
        claims["cognito:groups"] = groups
    return {
        "rawPath": path,
        "body": body or {},
        "pathParameters": path_parameters or {},
        "requestContext": {
            "http": {"method": method},
            "authorizer": {"jwt": {"claims": claims}},
        },
    }


class ModerationHandlerTests(unittest.TestCase):
    def setUp(self):
        self.original_cases_table = moderation.cases_table
        self.original_reels_table = moderation.reels_table
        self.original_blocks_table = moderation.blocks_table
        self.original_client = moderation.dynamodb_client
        self.original_cognito = moderation.cognito
        self.original_user_pool_id = moderation.USER_POOL_ID

    def tearDown(self):
        moderation.cases_table = self.original_cases_table
        moderation.reels_table = self.original_reels_table
        moderation.blocks_table = self.original_blocks_table
        moderation.dynamodb_client = self.original_client
        moderation.cognito = self.original_cognito
        moderation.USER_POOL_ID = self.original_user_pool_id

    def test_admin_queue_rejects_non_admin(self):
        result = moderation.lambda_handler(
            event("GET", "/admin/moderation/cases", groups=[]),
            None,
        )
        self.assertEqual(result["statusCode"], 403)

    def test_block_rejects_self_block(self):
        result = moderation.lambda_handler(
            event(
                "POST",
                "/moderation/block",
                body={
                    "reportedUserId": "reporter-1",
                    "contentType": "user",
                    "contentId": "reporter-1",
                    "reason": "Test",
                },
            ),
            None,
        )
        self.assertEqual(result["statusCode"], 400)

    def test_post_report_quarantines_content_transactionally(self):
        moderation.cases_table = Mock()
        moderation.cases_table.get_item.return_value = {}
        moderation.reels_table = Mock()
        moderation.reels_table.query.return_value = {
            "Items": [{
                "id": "db-key-1",
                "reelId": "post-1",
                "visibility": "public",
                "title": "Test post",
            }]
        }
        moderation.dynamodb_client = Mock()

        result = moderation.lambda_handler(
            event(
                "POST",
                "/moderation/report",
                body={
                    "reportedUserId": "creator-1",
                    "contentType": "post",
                    "contentId": "post-1",
                    "postId": "post-1",
                    "reason": "Objectionable content",
                },
            ),
            None,
        )

        self.assertEqual(result["statusCode"], 202)
        transaction = moderation.dynamodb_client.transact_write_items.call_args.kwargs
        self.assertEqual(len(transaction["TransactItems"]), 2)
        post_update = transaction["TransactItems"][1]["Update"]
        self.assertEqual(
            post_update["ExpressionAttributeValues"][":pendingVisibility"]["S"],
            "moderation_pending",
        )

    def test_block_and_case_are_in_same_transaction(self):
        moderation.cases_table = Mock()
        moderation.cases_table.get_item.return_value = {}
        moderation.dynamodb_client = Mock()

        result = moderation.lambda_handler(
            event(
                "POST",
                "/moderation/block",
                body={
                    "reportedUserId": "creator-1",
                    "contentType": "chat",
                    "contentId": "chat-1",
                    "reason": "Abusive messages",
                },
            ),
            None,
        )

        self.assertEqual(result["statusCode"], 202)
        transaction = moderation.dynamodb_client.transact_write_items.call_args.kwargs
        self.assertEqual(len(transaction["TransactItems"]), 2)
        self.assertEqual(
            transaction["TransactItems"][1]["Put"]["TableName"],
            moderation.BLOCKS_TABLE_NAME,
        )

    def test_admin_cannot_suspend_self(self):
        moderation.USER_POOL_ID = "pool-1"
        moderation.cognito = Mock()
        moderation.cognito.admin_get_user.return_value = {
            "Username": "admin-1",
            "UserAttributes": [{"Name": "sub", "Value": "admin-1"}],
        }

        result = moderation.lambda_handler(
            event(
                "POST",
                "/admin/moderation/users/admin-1/status",
                body={"action": "suspend", "reason": "Security review"},
                user_id="admin-1",
                groups=["SmartyAdmins"],
                path_parameters={"userId": "admin-1"},
            ),
            None,
        )

        self.assertEqual(result["statusCode"], 400)
        moderation.cognito.admin_disable_user.assert_not_called()

    def test_admin_cannot_suspend_another_admin(self):
        moderation.USER_POOL_ID = "pool-1"
        moderation.cognito = Mock()
        moderation.cognito.admin_get_user.return_value = {
            "Username": "admin-2",
            "UserAttributes": [{"Name": "sub", "Value": "admin-2"}],
        }
        moderation.cognito.admin_list_groups_for_user.return_value = {
            "Groups": [{"GroupName": "SmartyAdmins"}],
        }

        result = moderation.lambda_handler(
            event(
                "POST",
                "/admin/moderation/users/admin-2/status",
                body={"action": "suspend", "reason": "Security review"},
                user_id="admin-1",
                groups=["SmartyAdmins"],
                path_parameters={"userId": "admin-2"},
            ),
            None,
        )

        self.assertEqual(result["statusCode"], 409)
        moderation.cognito.admin_disable_user.assert_not_called()


if __name__ == "__main__":
    unittest.main()
