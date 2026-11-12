"""Exercise the post rotation and editorial prompts without a live model."""
import json
import random
import unittest
from unittest import mock

from content_catalog import CURIOSITY_ANGLE_IDS, MAKE_PROJECT_EXAMPLES
from test_content_quality import LAMBDA


class CuriosityPostTests(unittest.TestCase):
    def simulate_rotation(self, topic):
        randomizer = random.Random(42)
        angles = []
        with mock.patch.object(LAMBDA.random, "choice", side_effect=randomizer.choice):
            for _ in range(60):
                recent = [{"contentAngle": angle} for angle in reversed(angles)]
                angles.append(LAMBDA.choose_content_angle(recent, topic)["id"])
        return angles

    def test_curiosity_formats_recur_without_replacing_existing_formats(self):
        self.assertIn("Engineering", MAKE_PROJECT_EXAMPLES)
        angles = self.simulate_rotation("Engineering")
        self.assertEqual(set(angles[:3]), CURIOSITY_ANGLE_IDS)
        self.assertTrue(CURIOSITY_ANGLE_IDS.issubset(angles[-24:]))
        self.assertTrue({"mechanism", "comparison", "current_connection"}.issubset(angles[-24:]))
        self.assertNotIn("documented_history", angles)

    def test_non_project_topics_keep_other_curiosity_formats(self):
        angles = self.simulate_rotation("Microbiology")
        self.assertTrue({"everyday_question", "fresh_perspective"}.issubset(angles[-24:]))
        self.assertNotIn("make_something", angles)
        with mock.patch.object(LAMBDA, "call_bedrock_text") as model:
            angle = LAMBDA.resolve_content_angle("make_something")
            self.assertIsNone(LAMBDA.generate_specific_post("Microbiology", "unrelated lesson", angle, []))
        model.assert_not_called()

    def test_hands_on_prompt_and_review_use_the_same_project_requirements(self):
        angle = LAMBDA.resolve_content_angle("make_something")
        draft = {
            "title": "Make a Paper Bridge With Folded Edges",
            "mechanismParagraph": (
                "A strip of paper sags when you lay it across two books. Fold its long "
                "edges up and the same paper becomes a shallow channel. To bend the "
                "bridge downward, a load has to stretch material on one side of the "
                "bend and compress it on the other. The fold puts more of the paper "
                "farther from the middle of the bend, where stretching or compressing "
                "it takes more effort. You need two books, paper and several coins."
            ),
            "exampleParagraph": (
                "Place the books close enough for a strip to reach across with both "
                "ends resting securely. Cut two equal strips. Set one across the gap, "
                "add coins at its center one at a time and note when it sags. Fold "
                "the long edges of the other strip upward, and repeat with the same "
                "gap and coins. Then try a shorter gap to see how the support spacing "
                "matters too. A stronger paper bridge does not have to use more paper."
            ),
            "sourceIds": [],
        }
        approval = '{"accurate":true,"readerReady":true,"issues":[]}'
        rejection = '{"accurate":true,"readerReady":false,"issues":["Specify a safe observable check"]}'
        for verdict, passes in ((approval, True), (rejection, False)):
            with (
                self.subTest(passes=passes),
                mock.patch.object(LAMBDA, "load_editorial_evidence", return_value={"mode": "concept", "sources": []}),
                mock.patch.object(LAMBDA, "call_bedrock_text", side_effect=[json.dumps(draft), verdict]) as model,
            ):
                feedback = []
                post = LAMBDA.generate_specific_post(
                    "Engineering", "how folded edges stiffen a paper bridge", angle, [], feedback=feedback,
                )
                self.assertEqual(model.call_count, 2)
                self.assertIn(MAKE_PROJECT_EXAMPLES["Engineering"], model.call_args_list[0].args[0])
                self.assertIn(angle["review"], model.call_args_list[1].args[0])
                if passes:
                    self.assertEqual(post["contentAngle"], angle["id"])
                else:
                    self.assertIsNone(post)
                    self.assertEqual(feedback, ["Specify a safe observable check"])
