import CalendarEvent = GoogleAppsScript.Calendar.CalendarEvent;
import { getSunset } from 'sunrise-sunset-js';

import { addDays, addHours, addMinutes, getHHMM } from './util';
import { config } from '../config';
import { EventTransparency, GoogleCalendarColors, GoogleCalendarGuestStatus } from './GoogleCalendarEnums';

interface TargetDescription {
  baseEventId: string;
}

type ISycnedEvents = Record<string, CalendarEvent[]>;

export class CalendarService {
  static cleanup(config: Cleanup): void {
    if (!config.CalID) {
      Logger.log('No calendar ID provided');
      return;
    }

    const cal = CalendarApp.getCalendarById(config.CalID);

    const today = new Date();
    today.setDate(today.getDate() - 1);
    const endDate = new Date();
    endDate.setDate(today.getDate() + config.Days || 30);

    const primaryEvents = cal.getEvents(today, endDate); // all calendar events

    for (const event of primaryEvents) {
      const match = event.getTitle().match(config.Regex);
      if (match && match.length) {
        Logger.log(`deleting event: ${event.getTitle()} at ${event.getStartTime()} - ${event.getEndTime()}, desc: ${event.getDescription()}`);
        event.deleteEvent();
      }
    }
  }

  static createEndingSoonEvents(): void {
    if (!config.EndingSoonEvents.Enabled) {
      return;
    }

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + config.EndingSoonEvents.LookAheadDays); // how many days in advance to monitor and block off time

    const baseCal = CalendarApp.getCalendarById(config.EndingSoonEvents.PrimaryCalID);
    const baseCalEvents = baseCal.getEvents(today, endDate); // all primary calendar events

    const endingSoonCal = CalendarApp.getCalendarById(config.EndingSoonEvents.EndNotifCalID);
    const endingSoonCalEvents = endingSoonCal.getEvents(today, endDate);

    const syncedEvents: ISycnedEvents = {}; // to contain primary calendar events that were previously created from secondary calendar

    Logger.log('Number of pullCalEvents: ' + baseCalEvents.length);
    Logger.log('Number of pushCalEvents: ' + endingSoonCalEvents.length);

    // create filtered list of existing primary calendar events that were previously created from the secondary calendar
    for (const targetEvent of endingSoonCalEvents) {
      Logger.log(`adding ${targetEvent.getTitle()} to syncedEvents`);

      let descJson: TargetDescription;
      try {
        descJson = JSON.parse(targetEvent.getDescription());
      } catch {
        continue;
      }

      syncedEvents[descJson.baseEventId] = syncedEvents[descJson.baseEventId] || []; // make sure the array is created
      syncedEvents[descJson.baseEventId].push(targetEvent);
    }

    Logger.log(`${JSON.stringify(syncedEvents)}`);

    // process all events found in the pulling calendar
    for (const baseEvent of baseCalEvents) {
      if (baseEvent.isAllDayEvent()) {
        continue;
      }

      if (this.hasDeclined(baseEvent)) {
        Logger.log(`skipping event ${baseEvent.getTitle()} because it's declined`);
        continue;
      }

      // does the baseEvent exist in targetCal?
      const expectedTitle = `Ending Soon: ${baseEvent.getTitle()}`;

      const matchingTargetEvents = syncedEvents[baseEvent.getId()];
      if (matchingTargetEvents && matchingTargetEvents.length) {
        const matchingEvent = matchingTargetEvents.shift();
        if (!matchingEvent) {
          continue;
        }

        Logger.log(`found ${matchingTargetEvents.length} for ${matchingEvent.getTitle()}`);

        // then let's sync up the time if we need to
        if (!(baseEvent.getStartTime().getTime() === matchingEvent.getStartTime().getTime() && baseEvent.getEndTime().getTime() === matchingEvent.getEndTime().getTime())) {
          matchingEvent.setTime(baseEvent.getEndTime(), baseEvent.getEndTime());
        }

        if (matchingEvent.getTitle() !== expectedTitle) {
          matchingEvent.setTitle(expectedTitle);
        }

        // delete all other targetEvents (in case we have multiples) [0] is the most accurate one
        matchingTargetEvents.forEach((event) => {
          Logger.log(`removing ${event.getTitle()} from calendar`);
          try {
            event.deleteEvent();
          } catch {
            // pass
          }
        });

        Logger.log(`events remaining for ${baseEvent.getId()}: ${baseEvent.getTitle()}`);
        continue;
      }

      // event must not exists, let's go ahead and create it in the targetCal
      const newEvent = endingSoonCal.createEvent(expectedTitle, baseEvent.getEndTime(), baseEvent.getEndTime());

      const descJSON: TargetDescription = {
        baseEventId: baseEvent.getId()
      };
      newEvent.setDescription(JSON.stringify(descJSON));

      // newEvent.setVisibility(CalendarApp.Visibility.PRIVATE); // set blocked time as private appointments in work calendar
      // newEvent.removeAllReminders(); // so you don't get double notifications. Delete this if you want to keep the default reminders for your newly created primary calendar events

      Logger.log(`target event created: ${newEvent.getTitle()}`);
    }

    // let's remove any events that haven't been updated
    const keys = Object.keys(syncedEvents);
    Logger.log(`cleaning up ${keys} old entries`);
    keys.forEach((eventId) => {
      const events = syncedEvents[eventId];
      Logger.log(`eventId: ${eventId}: ${events}`);
      if (events && events.length) {
        events.forEach((event) => {
          Logger.log(`removing ${event.getTitle()}`);
          try {
            event.deleteEvent();
          } catch {
            // pass
          }
        });
      }
    });
  }

  static hasDeclined(event: GoogleAppsScript.Calendar.CalendarEvent): boolean {
    Logger.log(`checking for my status on ${event.getTitle()}: ${event.getMyStatus()}`);

    let declined = false;

    // TODO: the enums aren't working, so use strings to compare
    const myStatus = `${event.getMyStatus()}`;

    if (myStatus == GoogleCalendarGuestStatus.NO) {
      declined = true;
    }

    // note, if I own the event, i'll need to check the guest list to see if I declined it myself or not
    if (myStatus == GoogleCalendarGuestStatus.OWNER) {
      const guestList = event.getGuestList();
      if (guestList && guestList.length) {
        for (const g of guestList) {
          Logger.log(`checking for declined (in guest list): ${event.getTitle()}: ${g.getEmail()} is '${g.getGuestStatus()}'`);
          if (g.getEmail() == config.EndingSoonEvents.PrimaryCalID && `${g.getGuestStatus()}` === GoogleCalendarGuestStatus.NO) {
            declined = true;
            break;
          }
        }
      }
    }

    const containsCancelled = event.getTitle().match(/\[cancelled]/);
    if (containsCancelled) {
      Logger.log(`${event.getTitle()} has [cancelled] in title`);
      declined = true;
    }

    return declined;
  }

  static createWalkEvent(): void {
    if (!config.SunsetWalkEvents.Enabled) {
      return;
    }

    this.cleanup({
      CalID: config.EndingSoonEvents.PrimaryCalID,
      Regex: /Sunset Walk. Sunset.*/,
      Enabled: true,
      Days: config.SunsetWalkEvents.DaysToCreate * 2
    });

    const cal = CalendarApp.getCalendarById(config.EndingSoonEvents.PrimaryCalID);

    for (let i = 1; i <= config.SunsetWalkEvents.DaysToCreate; i++) {
      const todaySunset = getSunset(config.SunsetWalkEvents.Latitude, config.SunsetWalkEvents.Longitude, addDays(new Date(), i));
      Logger.log(`sunset is at ${todaySunset}`);

      const event = cal.createEvent(`[placeholder] Sunset Walk. Sunset@${getHHMM(todaySunset)}`, addHours(todaySunset, -1), addMinutes(todaySunset, 15), {
        location: `🌅`
      });

      event.setColor(GoogleCalendarColors.TANGERINE.toString());

      Logger.log(`created event: ${event.getId()} ${event.getTitle()} @ ${event.getStartTime()} - ${event.getEndTime()}`);
    }
  }

  static blockCals(): void {
    for (const blockCal of config.BlockCalendars) {
      if (blockCal.Enabled) {
        this.blockCal(blockCal);
      }
    }
  }

  static blockCal(config: BlockCalWithPlaceHolderType | BlockCalWithFromTitle): void {
    Logger.log(`syncing ${config.FromCalId} to ${config.ToCalId}`);

    const workEventPlaceholderTitle = config.TitlePlaceholder || 'Busy';

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + config.Days); // how many days in advance to monitor and block off time

    const fromCal = CalendarApp.getCalendarById(config.FromCalId);
    const fromEvents = fromCal.getEvents(today, endDate);
    Logger.log('Number of From Events: ' + fromEvents.length);

    const toCal = CalendarApp.getCalendarById(config.ToCalId);
    const ToEvents = toCal.getEvents(today, endDate);
    Logger.log('Number of To events: ' + ToEvents.length);

    const syncedEventsById: ISycnedEvents = {};

    // find all events we synced previously
    for (const event of ToEvents) {
      if (event.getDescription().match(/"baseEventId"/)) {
        try {
          const desc: TargetDescription = JSON.parse(event.getDescription());
          syncedEventsById[desc.baseEventId] = syncedEventsById[desc.baseEventId] || []; // make sure the array is created
          syncedEventsById[desc.baseEventId].push(event);
        } catch {
          // ignored, prob not actually an event created by us
        }
      }
    }

    // process all events in From calendar
    for (const fromEvent of fromEvents) {
      const fromId = fromEvent.getId();

      // if the fromEvent has a different time, then we should update the time
      if (syncedEventsById[fromId]) {
        const newStartTime = fromEvent.getStartTime();
        const newEndTime = fromEvent.getEndTime();

        let timeMatch = false;
        const found = syncedEventsById[fromId];

        for (let i = 0; i < found.length; i++) {
          const w = found[i];
          if (w.getStartTime().getTime() === newStartTime.getTime() && w.getEndTime().getTime() === newEndTime.getTime()) {
            found.splice(i, 1); // remove it from the array
            timeMatch = true;
            break;
          }
        }

        if (timeMatch) {
          Logger.log(`ignoring event for "${fromEvent.getTitle()}", already exists at the right time: ${newStartTime} - ${newEndTime}`);
          continue;
        }
      }

      // somehow the enum isn't working... so just convert it to a string and compare
      if (fromEvent.getTransparency() == EventTransparency.TRANSPARENT) {
        Logger.log(`ignoring event for "${fromEvent.getTitle()}", it's transparent`);
        continue;
      }

      if (this.hasDeclined(fromEvent)) {
        Logger.log(`ignoring event for "${fromEvent.getTitle()}", it's cancelled.`);
        continue;
      }

      if (fromEvent.isAllDayEvent()) {
        continue; // Do nothing if the event is an all-day or multi-day event. This script only syncs hour-based events
      }

      // ignore events that have the To cal invited
      if (fromEvent.getGuestList().filter((guest) => guest.getEmail() === config.ToCalId).length > 0) {
        Logger.log(`ignoring event for "${fromEvent.getTitle()}", it's already invited.`);
        continue;
      }

      // if the To event does not exist in the From calendar, create it
      const day = fromEvent.getStartTime().getDay();
      const timeHour = fromEvent.getStartTime().getHours();

      if (config.SkipWeekends || (!config.SkipWeekends && (day === 6 || day === 0))) {
        Logger.log(`skipping event for "${fromEvent.getTitle()}", it's on a weekend. Day: ${day}`);
        continue;
      } else if (timeHour < config.WorkDayStartHour || config.WorkDayEndHour <= timeHour) {
        // skip events outside of work hours
        Logger.log(`skipping event for "${fromEvent.getTitle()}", it's outside of work hours. Hour: ${timeHour}`);
        continue;
      }

      // if it's one of our placeholder event, skip it
      if (fromEvent.getDescription().includes('"baseEventId"')) {
        Logger.log(`skipping event "${fromEvent.getTitle()}" because it's a mirrored event`);
        continue;
      }

      let title = workEventPlaceholderTitle;
      if (config.CopyEventTitle) {
        title = fromEvent.getTitle();
      }

      const newEvent = toCal.createEvent(title, fromEvent.getStartTime(), fromEvent.getEndTime());
      const desc: TargetDescription = {
        baseEventId: fromId
      };
      newEvent.setDescription(JSON.stringify(desc));
      newEvent.setVisibility(CalendarApp.Visibility.PRIVATE);
      newEvent.removeAllReminders();
      if (config.SyncLocationField) {
        newEvent.setLocation(fromEvent.getLocation());
      }
      Logger.log(`created new blocking event for "${fromEvent.getTitle()}": ${newEvent.getId()} ${newEvent.getTitle()} @ ${newEvent.getStartTime()} - ${newEvent.getEndTime()}`);
    }

    // if a To event previously created no longer exists in the secondary calendar, delete it
    for (const toCalEvents of Object.values(syncedEventsById)) {
      for (const toCalEvent of toCalEvents) {
        try {
          const fromCalEventId = JSON.parse(toCalEvent.getDescription()).baseEventId;
          if (!fromCal.getEventById(fromCalEventId)) {
            // aka it's been deleted from the fromCal
            Logger.log(`ToCal cleanup: deleting ${toCalEvent.getTitle()} at ${toCalEvent.getStartTime()} - ${toCalEvent.getEndTime()}`);
            toCalEvent.deleteEvent();
          }
        } catch (e) {
          Logger.log(`error deleting event ${toCalEvent.getTitle()} at ${toCalEvent.getStartTime()}: ${e}`);
        }
      }
    }
  }
}
