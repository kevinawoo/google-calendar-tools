import { addDays, addHours, addMinutes, getDayFormat, getHHMM } from './util';

jest.unmock('./util');

describe('util', () => {
  describe('getDayFormat()', () => {
    it('no parameter', () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      expect(getDayFormat()).toBe(expected);
    });

    it('with date parameter', () => {
      const date = new Date(2018, 2, 9);
      expect(getDayFormat(date)).toBe('2018-3-9');
    });
  });

  describe('addMinutes()', () => {
    it('no parameter', () => {
      const now = new Date();
      const expected = now.getMinutes();
      expect(addMinutes().getMinutes()).toBe(expected);
    });

    it('adds 3 minutes', () => {
      const now = new Date();
      const expected = (now.getMinutes() + 3) % 60;
      expect(addMinutes(now, 3).getMinutes()).toBe(expected);
    });

    it('adds 120 minutes', () => {
      const now = new Date();
      const expected = (now.getMinutes() + 120) % 60;
      expect(addMinutes(now, 120).getMinutes()).toBe(expected);
    });

    it('adds -1 minutes', () => {
      const now = new Date();
      const expected = (now.getMinutes() - 1) % 60;
      expect(addMinutes(now, -1).getMinutes()).toBe(expected);
    });
  });

  describe('addHours()', () => {
    it('no parameter', () => {
      const now = new Date();
      const expected = now.getHours();
      expect(addHours().getHours()).toBe(expected);
    });

    it('adds 3 hours', () => {
      const now = new Date();
      const expected = (now.getHours() + 3) % 24;
      expect(addHours(now, 3).getHours()).toBe(expected);
    });

    it('adds 48 hours', () => {
      const now = new Date();
      const expected = (now.getHours() + 48) % 24;
      expect(addHours(now, 48).getHours()).toBe(expected);
    });

    it('adds -1 hours', () => {
      const now = new Date();
      const expected = (now.getHours() - 1) % 24;
      expect(addHours(now, -1).getHours()).toBe(expected);
    });
  });

  describe('addDays()', () => {
    it('no parameter', () => {
      const now = new Date();
      const expected = now.getDate();
      expect(addDays().getDate()).toBe(expected);
    });

    it('adds 3 days', () => {
      const now = new Date(Date.parse('09 Nov 2020 19:45:22 PST'));
      const expected = now.getDate() + 3;
      expect(addDays(now, 3).getDate()).toBe(expected);
    });

    it('adds 30 days (across month)', () => {
      const now = new Date(Date.parse('09 Nov 2020 19:45:22 PST'));
      const expected = new Date(Date.parse('09 Dec 2020 19:45:22 PST')).getDate();
      expect(addDays(now, 30).getDate()).toBe(expected);
    });

    it('adds -1 days', () => {
      const now = new Date(Date.parse('09 Nov 2020 19:45:22 PST'));
      const expected = new Date(Date.parse('08 Nov 2020 19:45:22 PST')).getDate();
      expect(addDays(now, -1).getDate()).toBe(expected);
    });

    it('adds -30 days (across months)', () => {
      const now = new Date(Date.parse('09 Nov 2020 19:45:22 PST'));
      const expected = new Date(Date.parse('10 Oct 2020 19:45:22 PST')).getDate();
      expect(addDays(now, -30).getDate()).toBe(expected);
    });
  });

  describe('getHHMM()', () => {
    it('gets HH:MM correctly with double digits', () => {
      const now = new Date(Date.parse('09 Nov 2020 02:45:22 PST'));
      const expected = '02:45';
      expect(getHHMM(now)).toBe(expected);
    });
  });
});
