import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAM_BLUEPRINTS, EXAM_STARTER_QUESTIONS, EXAM_REPAIR_QUESTIONS, makeExamTopic, getExamStarterQuestions, getExamRepairQuestion } from './examPractice.js';
import { normalizeTeachingQuality, normalizeRepairQuestion, answerRepair } from '../../infrastructure/shared/quizQuestionQuality.mjs';
import { normalizeGeneratedQuestions, getQuizResult } from '../lib/quizLearning.js';
import { getQuestionFingerprint, getQuizContextKey } from '../lib/quizQuestionStore.js';

test('each named exam has scoped, versioned objectives and an official reference', () => {
  assert.equal(EXAM_BLUEPRINTS.length,4);
  for (const exam of EXAM_BLUEPRINTS) {
    assert.ok(exam.version && exam.coverage && exam.domains.length >= 3);
    assert.equal(new URL(exam.url).protocol,'https:');
    assert.equal(makeExamTopic(exam.id).format,'practice');
    assert.equal(makeExamTopic(exam.id,'not-a-domain'),null);
    for (const domain of exam.domains) {
      const topic = makeExamTopic(exam.id,domain.id);
      assert.equal(topic.examDomain,domain.id); assert.equal(topic.baseTopicId,makeExamTopic(exam.id).id);
      assert.equal(topic.focus,domain.focus);
    }
  }
  assert.equal(makeExamTopic('not-an-exam'),null);
});
test('all 36 original starter questions have distinct answers, worked steps and option-specific teaching', () => {
  assert.equal(EXAM_STARTER_QUESTIONS.length,36);
  assert.equal(new Set(EXAM_STARTER_QUESTIONS.map(question => question.id)).size,36);
  assert.equal(new Set(EXAM_STARTER_QUESTIONS.map(getQuestionFingerprint)).size,36);
  for (const exam of EXAM_BLUEPRINTS) {
    for (const difficulty of ['Easy','Medium','Hard']) {
      const questions = getExamStarterQuestions(makeExamTopic(exam.id),{difficulty});
      assert.equal(questions.length,3);
      for (const question of questions) {
        assert.equal(question.options.length,4);
        assert.equal(new Set(question.options).size,4);
        assert.ok(question.options.includes(question.answer));
        assert.ok(question.explanation.length >= 80);
        assert.ok(normalizeTeachingQuality(question,{...question, required:true,passageRequired:Boolean(exam.passageRequired)}),question.id);
      }
    }
  }
});
test('an unseen repair is related but different; it does not count as a corrected first answer', () => {
  const topic = makeExamTopic('terraform-associate-004','state');
  const original = getExamStarterQuestions(topic)[0];
  const wrong = original.options.find(option => option !== original.answer);
  const repair = answerRepair(original,wrong);
  assert.equal(repair.reason,original.distractorExplanations[wrong]);
  assert.equal(answerRepair(original,original.answer),null);
  const followup = getExamRepairQuestion(original);
  assert.equal(followup.examDomain,original.examDomain); assert.notEqual(followup.q,original.q);
  const seen = [...EXAM_STARTER_QUESTIONS,...EXAM_REPAIR_QUESTIONS].map(getQuestionFingerprint);
  assert.equal(getExamRepairQuestion(original,{seen}),null);
  assert.equal(getExamStarterQuestions(topic,{seen}).length,0);
  assert.equal(getQuizResult([{isCorrect:false}]).percent,0);
});
test('hard questions cannot be relabelled recall; repair and evidence survive client normalization', () => {
  const original = EXAM_STARTER_QUESTIONS.find(question => question.difficulty === 'Hard' && question.passage);
  const repairQuestion = {q:'Did the bus trial establish the previous travel choices of its additional passengers?',
    options:['No, those travel choices remained uncertain','Yes, every passenger previously drove','Yes, every passenger previously walked','Yes, every passenger used a different bus'],
    answer:'No, those travel choices remained uncertain',explanation:'Passenger counts rose, but the passage does not establish how people travelled before the trial. A measured increase is not proof of one particular source of that increase.'};
  const payload = {...original,repairQuestion};
  const [normalized] = normalizeGeneratedQuestions([payload],'exam',{requireQuality:true,passageRequired:true});
  assert.equal(normalized.evidence,original.evidence);
  assert.equal(normalized.misconception,original.misconception);
  assert.ok(normalized.repairQuestion);
  assert.equal(normalizeGeneratedQuestions([{...payload,reasoningKind:'foundation'}],'exam',{requireQuality:true}).length,0);
  assert.equal(normalizeGeneratedQuestions([{...payload,evidence:'Invented statement not in this passage'}],'exam',{requireQuality:true,passageRequired:true}).length,0);
  assert.equal(normalizeGeneratedQuestions([{...payload,passage:'A short statement is not a reading passage.',evidence:'not a reading passage'}],'exam',{requireQuality:true,passageRequired:true}).length,0);
  assert.equal(normalizeRepairQuestion({...repairQuestion,q:original.q},original.q),null);
  assert.equal(normalizeRepairQuestion({...repairQuestion,options:['A','a','C','D']},original.q),null);
  assert.equal(normalizeRepairQuestion({...repairQuestion,options:['w','x','y','z'],answer:'w'},original.q),null);
});
test('every starter repair has valid choices and targets one authored question', () => {
  assert.equal(EXAM_REPAIR_QUESTIONS.length,12);
  for (const repair of EXAM_REPAIR_QUESTIONS) {
    const original = EXAM_STARTER_QUESTIONS.find(question => question.id + '-repair' === repair.id);
    assert.ok(original); assert.ok(normalizeRepairQuestion(repair,original.q));
    assert.equal(repair.examDomain,original.examDomain);
    if (original.passage) assert.equal(repair.passage,original.passage);
  }
  const hardState = EXAM_STARTER_QUESTIONS.find(question => question.id === 'starter-terraform-associate-004-state-hard');
  assert.equal(getExamRepairQuestion(hardState),null,'Do not present a different broad-area question as a repair of this concept.');
});
test('browser cache contexts isolate exam versions and areas', () => {
  const topic = makeExamTopic('terraform-associate-004');
  assert.notEqual(getQuizContextKey(topic),getQuizContextKey({...topic,examVersion:'next-version'}));
  assert.notEqual(getQuizContextKey(topic),getQuizContextKey({...topic,examDomain:'state'}));
});
