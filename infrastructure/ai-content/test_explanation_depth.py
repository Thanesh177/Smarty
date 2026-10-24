import json
import unittest
from unittest import mock

import test_content_quality as quality

LAMBDA = quality.LAMBDA


class ExplanationDepthTests(unittest.TestCase):
    def setUp(self):
        self.lesson = quality.ContentCatalogTests.complete_explanation()
        self.body = (
            "A decoder caches keys and values for earlier tokens. It then reuses "
            "those calculations when generating the next token. This saves repeated "
            "work, but keeping more tokens in the cache requires more memory."
        )

    def test_subject_specific_lesson_expands_a_short_post(self):
        self.assertTrue(LAMBDA.is_expanded_detailed_explanation(self.lesson, self.body))

    def test_long_structurally_complete_copy_is_rejected(self):
        self.assertTrue(LAMBDA.is_complete_detailed_explanation(self.lesson))
        self.assertFalse(LAMBDA.is_expanded_detailed_explanation(self.lesson, self.lesson))

    def test_copied_lesson_is_not_returned_or_grounding_reviewed(self):
        with (mock.patch.object(LAMBDA, "call_bedrock_text", return_value=self.lesson),
              mock.patch.object(LAMBDA, "review_grounded_text") as review):
            answer = LAMBDA.generate_detailed_explanation("A cache", self.lesson)
        self.assertEqual(answer, "")
        review.assert_not_called()

    def test_one_short_quote_does_not_reject_an_expanded_lesson(self):
        quoted = self.lesson.split("##", 1)[0].strip()
        self.assertTrue(LAMBDA.is_expanded_detailed_explanation(self.lesson, quoted))

    def test_repetition_is_not_an_explanation(self):
        sentence = "This section names the important parts and explains why each change produces the next observable result. "
        padded = sentence * 4 + "\n\n" + "\n\n".join(
            f"## {heading}\n\n{sentence * 8}" for heading in (
                "Saved tokens need not start over", "A token through the decoder",
                "The memory behind the answer", "Keeping a context for later",
            )
        )
        self.assertTrue(LAMBDA.is_complete_detailed_explanation(padded))
        self.assertFalse(LAMBDA.is_expanded_detailed_explanation(padded, self.body))

    def test_prompt_requires_new_depth_terms_origin_and_evidence_boundaries(self):
        for title, topic in (("KV cache", "AI"), ("An ancient city's water system", "History"), ("Why a refrigerator moves heat", "Engineering")):
            with mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[self.lesson, '{"accurate":true,"issues":[]}']) as model:
                LAMBDA.generate_detailed_explanation(title, self.body, topic)
            prompt = model.call_args_list[0].args[0]
            for requirement in (
                "Limit recap to two", "at least THREE substantive gaps",
                "Expand acronyms at first use", "deceptively familiar words",
                "Explain the prerequisite", "how the subject came to be",
                "Do not force an origin", "Current developments must use dated retrieved reports",
                "records", "untrusted source material", "intermediate changes",
                "clearly hypothetical setup", "steady state", "limiting case",
                "A conservation law alone does not prove",
            ):
                self.assertIn(requirement, prompt)
            self.assertIn(json.dumps(title), prompt)
            self.assertTrue(model.call_args.kwargs["require_complete"])

    def test_accuracy_review_rejection_cannot_be_returned_as_a_saved_lesson(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[self.lesson, '{"accurate":false,"issues":["wrong causal inference"]}'] * 2) as model:
            self.assertEqual(LAMBDA.generate_detailed_explanation("A mechanism", self.body), "")
        self.assertEqual(model.call_count, 4)

    def test_one_corrective_attempt_must_also_pass_review(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[
            self.lesson, '{"accurate":false,"issues":["wrong causal inference"]}',
            self.lesson, '{"accurate":true,"issues":[]}',
        ]) as model:
            self.assertEqual(LAMBDA.generate_detailed_explanation("A mechanism", self.body), self.lesson)
        self.assertEqual(model.call_count, 4)
        self.assertIn('wrong causal inference', model.call_args_list[2].args[0])

    def test_incomplete_review_does_not_launch_another_generation(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[self.lesson, '']) as model:
            self.assertEqual(LAMBDA.generate_detailed_explanation("A mechanism", self.body), "")
        self.assertEqual(model.call_count, 2)

    def test_accuracy_review_requires_strict_positive_complete_verdict(self):
        for verdict in ('{}', 'not JSON', '{"accurate":"true","issues":[]}', '{"accurate":true,"issues":["wrong premise"]}', '{"accurate":true}'):
            with mock.patch.object(LAMBDA, "call_bedrock_text", return_value=verdict):
                self.assertFalse(LAMBDA.review_concept_text(self.lesson))
        with mock.patch.object(LAMBDA, "call_bedrock_text", return_value='{"accurate":true,"issues":[]}') as model:
            self.assertTrue(LAMBDA.review_concept_text(self.lesson, {"body": "Untrusted source"}, LAMBDA.DETAILS_MODEL_ID))
        self.assertEqual(model.call_args.kwargs['max_tokens'], 450)
        self.assertEqual(model.call_args.kwargs['model_id'], LAMBDA.DETAILS_MODEL_ID)
        self.assertTrue(model.call_args.kwargs['require_complete'])

    def test_accuracy_review_failure_is_not_a_successful_lesson(self):
        with mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[self.lesson, RuntimeError("provider unavailable")]):
            self.assertEqual(LAMBDA.generate_detailed_explanation("A mechanism", self.body), "")

    def test_failed_generation_has_an_actionable_failure_not_empty_success(self):
        event = {"body": json.dumps({"postId": "p1"})}
        with (mock.patch.object(LAMBDA, "get_post", return_value={"id": "p1"}),
              mock.patch.object(LAMBDA, "ensure_post_explanation", return_value=("", False, False))):
            result = LAMBDA.handle_details(event)
        self.assertEqual(result["statusCode"], 503)
        self.assertIn("try again", json.loads(result["body"])["error"])


if __name__ == "__main__":
    unittest.main()
