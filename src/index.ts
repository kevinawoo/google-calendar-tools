import { CalendarService } from './CalendarService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let global: any;

global.cleanup = (): void => {
  CalendarService.cleanup();
};
global.sync = (): void => {
  CalendarService.createEndingSoonEvents();
  CalendarService.blockWorkCalWithPersonEventPlaceholders();
};
global.createWalkEvent = (): void => {
  CalendarService.createWalkEvent();
};
global.blockWorkCalWithPersonEventPlaceholders = (): void => {
  CalendarService.blockWorkCalWithPersonEventPlaceholders();
};
