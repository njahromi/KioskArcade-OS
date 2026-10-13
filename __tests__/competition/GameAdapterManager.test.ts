import { GameAdapterManager } from '../../electron-app/services/GameAdapterManager';

describe('GameAdapterManager', () => {
  it('supports tetris, snake, and pong', () => {
    const manager = new GameAdapterManager();
    expect(manager.listSupportedGameIds().sort()).toEqual(['pong', 'snake', 'tetris']);
  });

  it('normalizes guest score payloads', () => {
    const manager = new GameAdapterManager();
    const sample = manager.normalize('snake', {
      type: 'kioskarcade:score',
      gameId: 'snake',
      score: 42.7,
      event: 'final',
      progress: { length: 12 }
    });
    expect(sample).toMatchObject({
      gameId: 'snake',
      score: 42,
      event: 'final'
    });
    expect(sample?.progress?.length).toBe(12);
  });

  it('rejects mismatched game ids', () => {
    const manager = new GameAdapterManager();
    const sample = manager.normalize('tetris', {
      type: 'kioskarcade:score',
      gameId: 'snake',
      score: 10,
      event: 'update'
    });
    expect(sample).toBeNull();
  });
});
