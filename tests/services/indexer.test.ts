import * as indexer from '../../src/services/indexer';
import { server } from '../../src/services/stellar';

jest.mock('../../src/services/stellar', () => ({
  server: { getEvents: jest.fn().mockResolvedValue({ events: [] }) },
}));

describe('indexer', () => {
  afterEach(() => {
    indexer.stopIndexer();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('returns empty array when no events exist for a type', () => {
    const events = indexer.getEvents('player_registered');
    expect(Array.isArray(events)).toBe(true);
  });

  describe('normalizeEventId', () => {
    it('produces a stable canonical ID', () => {
      const id = indexer.normalizeEventId('CONTRACT_A', 100, '0xabc');
      expect(id).toBe('CONTRACT_A:100:0xabc');
    });

    it('produces different IDs for different inputs', () => {
      const a = indexer.normalizeEventId('C', 1, 'hash1');
      const b = indexer.normalizeEventId('C', 1, 'hash2');
      expect(a).not.toBe(b);
    });
  });

  describe('parseContractEvent', () => {
    it('extracts type, ledger, txHash, and payload from a raw event', () => {
      const raw = {
        ledger: 42,
        txHash: '0xdead',
        topic: [{ value: () => 'player_registered' }],
        value: { value: () => ({ playerId: 'p1' }) },
      };
      const parsed = indexer.parseContractEvent('CONTRACT_A', raw);
      expect(parsed.eventId).toBe('CONTRACT_A:42:0xdead');
      expect(parsed.type).toBe('player_registered');
      expect(parsed.ledger).toBe(42);
      expect(parsed.txHash).toBe('0xdead');
      expect(parsed.payload).toEqual({ playerId: 'p1' });
    });
  });

  describe('isEventDuplicate', () => {
    it('returns false for unseen events', () => {
      expect(indexer.isEventDuplicate('C:1:hash')).toBe(false);
    });

    it('returns true when eventId is in the seen set', () => {
      const seen = new Set(['C:1:hash']);
      expect(indexer.isEventDuplicate('C:1:hash', seen)).toBe(true);
    });
  });

  describe('startIndexer / stopIndexer', () => {
    it('polls on an interval until stopped', async () => {
      jest.useFakeTimers();
      const getEvents = server.getEvents as jest.Mock;

      indexer.startIndexer(1000);
      await Promise.resolve();
      expect(getEvents).toHaveBeenCalledTimes(1);

      indexer.startIndexer(1000);
      await Promise.resolve();
      expect(getEvents).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(getEvents).toHaveBeenCalledTimes(2);

      indexer.stopIndexer();
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(getEvents).toHaveBeenCalledTimes(2);
    });
  });
});
