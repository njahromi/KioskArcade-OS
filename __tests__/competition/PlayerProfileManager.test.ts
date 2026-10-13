import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { PlayerProfileManager } from '../../electron-app/services/PlayerProfileManager';

describe('PlayerProfileManager', () => {
  let tempDir: string;
  let cwdSpy: jest.SpyInstance;
  let manager: PlayerProfileManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiosk-player-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    manager = new PlayerProfileManager();
    await manager.initialize();
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await fs.remove(tempDir);
  });

  it('creates a public profile without exposing pinHash', async () => {
    const profile = await manager.createProfile('Nova', '1234');
    expect(profile.displayName).toBe('Nova');
    expect(profile.hasPin).toBe(true);
    expect(profile.qrPayload.startsWith('kioskarcade:player:')).toBe(true);
    expect((profile as { pinHash?: string }).pinHash).toBeUndefined();
  });

  it('requires PIN when identifying a protected profile', async () => {
    const created = await manager.createProfile('Nova', '4321');
    const missing = manager.identify({ qrPayload: created.qrPayload });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe('pin_required');

    const wrong = manager.identify({ qrPayload: created.qrPayload, pin: '0000' });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe('pin_invalid');

    const ok = manager.identify({ qrPayload: created.qrPayload, pin: '4321' });
    expect(ok.ok).toBe(true);
  });

  it('updates personal bests only when improved', async () => {
    const created = await manager.createProfile('Ace');
    expect(await manager.updatePersonalBest(created.id, 'tetris', 100)).toBe(true);
    expect(await manager.updatePersonalBest(created.id, 'tetris', 80)).toBe(false);
    expect(await manager.updatePersonalBest(created.id, 'tetris', 150)).toBe(true);
    const profile = manager.getPublicProfile(created.id);
    expect(profile?.personalBests['tetris']).toBe(150);
  });
});
