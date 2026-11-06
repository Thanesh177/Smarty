import unittest
from unittest.mock import Mock

from member_profile_reader import with_member_profiles


class MemberProfileTest(unittest.TestCase):
    def setUp(self):
        self.legacy = Mock(return_value=(200, {"legacy": True}))
        self.users, self.blocks, self.follows = Mock(), Mock(), Mock()
        self.users.get_item.return_value = {"Item": {
            "userId": "reader", "username": "skyreader", "name": "Reader",
            "email": "private@example.invalid", "pushToken": "not-public",
            "lastLoginSub": "reader", "postsCount": 0, "photoKey": "profiles/reader/photo.webp",
        }}
        self.blocks.get_item.return_value = {}
        self.follows.get_item.return_value = {}
        self.sign = Mock(return_value="https://example.invalid/avatar.webp")
        self.handler = with_member_profiles(
            self.legacy, get_method=lambda event: event["method"], get_claims=lambda event: event["claims"],
            response=lambda status, payload: (status, payload), users=self.users, blocks=self.blocks,
            follows=self.follows, sign_photo=self.sign, bucket="app-photos",
        )

    def run_request(self, target="reader", method="GET", viewer="viewer"):
        return self.handler({"method": method, "claims": {"sub": viewer}, "queryStringParameters": {"userId": target}}, None)

    def test_target_lookup_returns_a_real_member_even_with_no_posts(self):
        status, body = self.run_request()
        self.assertEqual(status, 200)
        self.assertEqual(body["profile"]["userId"], "reader")
        self.assertEqual(body["profile"]["postsCount"], 0)
        self.assertFalse(body["profile"]["isMe"])
        for field in ("email", "pushToken", "photoKey", "lastLoginSub"):
            self.assertNotIn(field, body["profile"])
        self.assertEqual(self.users.get_item.call_args.kwargs["Key"], {"userId": "reader"})
        self.sign.assert_called_once_with("profiles/reader/photo.webp")
        self.legacy.assert_not_called()
        self.users.put_item.assert_not_called()
        self.users.update_item.assert_not_called()

    def test_guest_and_invalid_id_do_not_read_member_data(self):
        self.assertEqual(self.run_request(viewer="")[0], 401)
        self.assertEqual(self.run_request(target="private@example.invalid")[0], 400)
        self.users.get_item.assert_not_called()

    def test_missing_deleted_or_hidden_accounts_are_not_exposed(self):
        for item in ({}, {"userId": "reader", "isDeleted": True}, {"userId": "reader", "profileVisibility": "hidden"}):
            self.users.get_item.return_value = {"Item": item}
            self.assertEqual(self.run_request()[0], 404)

    def test_block_in_either_direction_hides_profile(self):
        for blocks in ([{"Item": {"userId": "viewer"}}, {}], [{}, {"Item": {"userId": "reader"}}]):
            self.blocks.get_item.side_effect = blocks
            self.assertEqual(self.run_request()[0], 404)
        self.follows.get_item.assert_not_called()

    def test_profile_photo_reader_does_not_sign_other_uploads(self):
        self.users.get_item.return_value["Item"]["photoKey"] = "uploads/chat/private-message.jpg"
        self.assertEqual(self.run_request()[1]["profile"]["avatarUrl"], "")
        self.sign.assert_not_called()

    def test_follow_state_and_linked_self_profile_are_correct(self):
        for state, following, pending in (("approved", True, False), ("pending", False, True)):
            self.follows.get_item.return_value = {"Item": {"status": state}}
            profile = self.run_request()[1]["profile"]
            self.assertEqual((profile["isFollowing"], profile["requestPending"]), (following, pending))
        self.users.get_item.return_value["Item"]["lastLoginSub"] = "login-alias"
        self.assertTrue(self.run_request(viewer="login-alias")[1]["profile"]["isMe"])

    def test_existing_my_profile_and_updates_keep_their_original_handler(self):
        self.assertEqual(self.handler({"method": "GET", "claims": {"sub": "viewer"}}, None), (200, {"legacy": True}))
        self.assertEqual(self.run_request(method="PUT"), (200, {"legacy": True}))
        self.users.get_item.assert_not_called()

    def test_block_check_failure_fails_closed(self):
        self.blocks.get_item.side_effect = RuntimeError("database unavailable")
        self.assertEqual(self.run_request()[0], 503)
        self.sign.assert_not_called()


if __name__ == "__main__":
    unittest.main()
