import { CalendarService } from './CalendarService';
import { config } from '../config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let global: any;

global.cleanup = (): void => {
  for (const cfg of config.Cleanup)
    if (cfg) {
      CalendarService.cleanup(cfg);
    }
};

global.sync = (): void => {
  CalendarService.createEndingSoonEvents();
  CalendarService.blockCals();
};

global.createWalkEvent = (): void => {
  CalendarService.createWalkEvent();
};
