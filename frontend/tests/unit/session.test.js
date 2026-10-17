import { describe, expect, test } from '@jest/globals';

import Session from '../../app/types/session';
import { Click, Location } from '../../app/types/session/event';
import Issue from '../../app/types/session/issue';
import { session } from '../mocks/sessionResponse';
import { issues, events } from '../mocks/sessionData';

describe('Testing Session class', () => {
  const sessionInfo = new Session(session.data);

  test('checking type instances', () => {
    expect(sessionInfo).toBeInstanceOf(Session);
    expect(sessionInfo.issues[0]).toBeInstanceOf(Issue);
    expect(sessionInfo.events[0]).toBeInstanceOf(Location);
    expect(sessionInfo.events[1]).toBeInstanceOf(Click);
  });
  test('checking basic session info(id, userId, issues and events lengths to match)', () => {
    expect(sessionInfo.sessionId).toBe('8119081922378909');
    expect(sessionInfo.isMobile).toBe(false);
    expect(sessionInfo.userNumericHash).toBe(55003039);
    expect(sessionInfo.userId).toBe('fernando.dufour@pravaler.com.br');
    expect(sessionInfo.issues.length).toBe(2);
    expect(sessionInfo.mixedEventsWithIssues.length).toBe(362);
  });
  test('checking issue mapping', () => {
    expect([...sessionInfo.issues]).toMatchObject(issues);
  });
  test('checking events mapping', () => {
    expect([...sessionInfo.events.slice(0, 10)]).toMatchObject(events);
  });
});

// Caeli: the session list reads source/campaign off the search response
// (api search/source.go); the Session constructor must carry them through.
describe('Session source', () => {
  test('keeps source and campaign from the search response', () => {
    const s = new Session({ ...session.data, source: 'Google Ads', campaign: '24356000612' });
    expect(s.source).toBe('Google Ads');
    expect(s.campaign).toBe('24356000612');
  });
});
