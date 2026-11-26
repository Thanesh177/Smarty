import test from 'node:test';
import assert from 'node:assert/strict';
import { isPremiumQuizLevel, hasPremiumQuizMembership, filterQuizQuestionsForAccess } from '../../infrastructure/shared/quizAccess.mjs';

test('Hard and Challenge are premium; Easy and Medium remain free', () => {
  for (const value of ['Hard', 'Challenge', ' advanced ', 'EXPERT']) assert.equal(isPremiumQuizLevel(value), true);
  for (const value of ['Easy', 'Medium', 'Adaptive', '', null]) assert.equal(isPremiumQuizLevel(value), false);
});
test('membership requires an identified account in the exact server-managed group', () => {
  for (const groups of [['SmartyPremium'], 'SmartyPremium', '["SmartyPremium"]'])
    assert.equal(hasPremiumQuizMembership({sub:'member','cognito:groups':groups}), true);
  for (const claims of [null, {}, {sub:'member',isPremium:true}, {sub:'member',plan:'premium'},
    {'cognito:groups':['SmartyPremium']}, {sub:'member','cognito:groups':['SmartyAdmins']},
    {sub:'member','cognito:groups':['NotSmartyPremium']}, {sub:'member','cognito:groups':['smartypremium']}])
    assert.equal(hasPremiumQuizMembership(claims), false);
});
test('free fallback and saved decks cannot reintroduce premium questions', () => {
  const rows = ['Easy','Medium','Hard','Challenge'].map(difficulty=>({difficulty}));
  assert.deepEqual(filterQuizQuestionsForAccess(rows,false).map(row=>row.difficulty),['Easy','Medium']);
  assert.equal(filterQuizQuestionsForAccess(rows,true).length,4);
  assert.deepEqual(filterQuizQuestionsForAccess(null,false),[]);
});
