import CalendarEvent = GoogleAppsScript.Calendar.CalendarEvent;
import { getSunset } from 'sunrise-sunset-js';

import { addDays, addHours, addMinutes, getHHMM } from './util';
import { Config } from '../config';
import { GoogleCalendarColors, GoogleCalendarGuestStatus } from './GoogleCalendarEnums';

interface TargetDescription {
  baseEventId: string;
}

type ISycnedEvents = Record<string, CalendarEvent[]>;

export class CalendarService {
  static cleanup(calID = Config.EndingSoonEvents.EndNotifCalID, titleMatcher = /Ending Soon/): void {
    const primaryCal = CalendarApp.getCalendarById(calID);

    const today = new Date();
    today.setDate(today.getDate() - 1);
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14); // how many days in advance to monitor and block off time

    const primaryEvents = primaryCal.getEvents(today, endDate); // all primary calendar events

    for (const primaryEvent of primaryEvents) {
      const match = primaryEvent.getTitle().match(titleMatcher);
      if (match && match.length) {
        primaryEvent.deleteEvent();
      }
    }
  }

  static createEndingSoonEvents(): void {
    if (!Config.EndingSoonEvents.Enabled) {
      return;
    }

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + Config.EndingSoonEvents.LookAheadDays); // how many days in advance to monitor and block off time

    const baseCal = CalendarApp.getCalendarById(Config.EndingSoonEvents.PrimaryCalID);
    const baseCalEvents = baseCal.getEvents(today, endDate); // all primary calendar events

    const endingSoonCal = CalendarApp.getCalendarById(Config.EndingSoonEvents.EndNotifCalID);
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
      } catch (e) {
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
        matchingTargetEvents.forEach(event => {
          Logger.log(`removing ${event.getTitle()} from calendar`);
          try {
            event.deleteEvent();
          } catch (err) {
            // pass
          }
        });

        Logger.log(`events remaining for ${baseEvent.getId()}: ${baseEvent.getTitle()}`);
        continue;
      }

      // event must not exists, let's go ahead and create it in the targetCal
      const newEvent = endingSoonCal.createEvent(expectedTitle, baseEvent.getEndTime(), baseEvent.getEndTime());

      const descJSON: TargetDescription = { baseEventId: baseEvent.getId() };
      newEvent.setDescription(JSON.stringify(descJSON));

      // newEvent.setVisibility(CalendarApp.Visibility.PRIVATE); // set blocked time as private appointments in work calendar
      // newEvent.removeAllReminders(); // so you don't get double notifications. Delete this if you want to keep the default reminders for your newly created primary calendar events

      Logger.log(`target event created: ${newEvent.getTitle()}`);
    }

    // let's remove any events that haven't been updated
    const keys = Object.keys(syncedEvents);
    Logger.log(`cleaning up ${keys} old entries`);
    keys.forEach(eventId => {
      const events = syncedEvents[eventId];
      Logger.log(`eventId: ${eventId}: ${events}`);
      if (events && events.length) {
        events.forEach(event => {
          Logger.log(`removing ${event.getTitle()}`);
          try {
            event.deleteEvent();
          } catch (err) {
            // pass
          }
        });
      }
    });
  }

  static hasDeclined(event: GoogleAppsScript.Calendar.CalendarEvent): boolean {
    Logger.log(`checking for my status on ${event.getTitle()}: ${event.getMyStatus()}`);

    let declined = false;

    const myStatus = `${event.getMyStatus()}`;
    if (myStatus === GoogleCalendarGuestStatus.NO) {
      declined = true;
    }

    // note, if I own the event, i'll need to check the guest list to see if I declined it myself or not
    // seems like it doesn't work, but i'll keep it here anyways 🤷
    if (myStatus === GoogleCalendarGuestStatus.OWNER) {
      const guestList = event.getGuestList();
      if (guestList && guestList.length) {
        for (const g of guestList) {
          Logger.log(`checking for declined (in guest list): ${event.getTitle()}: ${g.getEmail()} is '${g.getGuestStatus()}'`);
          if (g.getEmail() == Config.EndingSoonEvents.PrimaryCalID && `${g.getGuestStatus()}` === GoogleCalendarGuestStatus.NO) {
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
    if (!Config.SunsetWalkEvents.Enabled) {
      return;
    }

    this.cleanup(Config.EndingSoonEvents.PrimaryCalID, /Sunset Walk. Sunset.*/);

    const cal = CalendarApp.getCalendarById(Config.EndingSoonEvents.PrimaryCalID);

    for (let i = 1; i <= Config.SunsetWalkEvents.DaysToCreate; i++) {
      const todaySunset = getSunset(Config.SunsetWalkEvents.Latitude, Config.SunsetWalkEvents.Longitude, addDays(new Date(), i));
      Logger.log(`sunset is at ${todaySunset}`);

      const event = cal.createEvent(`[placeholder] Sunset Walk. Sunset@${getHHMM(todaySunset)}`, addHours(todaySunset, -1), addMinutes(todaySunset, 15), {
        location: `🌅`
      });

      event.setColor(GoogleCalendarColors.TANGERINE.toString());

      Logger.log(`created event: ${event.getId()} ${event.getTitle()} @ ${event.getStartTime()} - ${event.getEndTime()}`);
    }
  }

  static blockWorkCalWithPersonEventPlaceholders(): void {
    if (!Config.BlockWorkCalWithPersonEventPlaceholders.Enabled) {
      return;
    }

    const workEventPlaceholderTitle = Config.BlockWorkCalWithPersonEventPlaceholders.WorkEventPlaceholderTitle || 'Busy'; // update this to the text you'd like to appear in the new events created in primary calendar

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14); // how many days in advance to monitor and block off time

    const personalCal = CalendarApp.getCalendarById(Config.BlockWorkCalWithPersonEventPlaceholders.PersonalCalID);
    const personalCalEvents = personalCal.getEvents(today, endDate);
    Logger.log('Number of personalEvents: ' + personalCalEvents.length);

    const workCal = CalendarApp.getCalendarById(Config.BlockWorkCalWithPersonEventPlaceholders.WorkCalID);
    const workCalEvents = workCal.getEvents(today, endDate);
    Logger.log('Number of workEvents: ' + workCalEvents.length);

    const syncedWorkEventsByPersonalEventId: ISycnedEvents = {};

    // create a list of events we've already synced before
    for (const event of workCalEvents) {
      if (event.getTitle() === workEventPlaceholderTitle) {
        try {
          const personalDesc: TargetDescription = JSON.parse(event.getDescription());
          syncedWorkEventsByPersonalEventId[personalDesc.baseEventId] = syncedWorkEventsByPersonalEventId[personalDesc.baseEventId] || []; // make sure the array is created
          syncedWorkEventsByPersonalEventId[personalDesc.baseEventId].push(event);
        } catch (e) {
          // ignored, prob not actually an event created by us
        }
      }
    }

    // process all events in secondary calendar
    for (const personalEvent of personalCalEvents) {
      const personalEventId = personalEvent.getId();

      // if the personalEvent has a different time, then we should update the time
      if (syncedWorkEventsByPersonalEventId[personalEventId]) {
        const foundWorkEvents = syncedWorkEventsByPersonalEventId[personalEventId];

        let matched = false;
        const pStartTime = personalEvent.getStartTime();
        const pEndTime = personalEvent.getEndTime();

        for (let i = 0; i < foundWorkEvents.length; i++) {
          const w = foundWorkEvents[i];
          if (w.getStartTime().getTime() === pStartTime.getTime() && w.getEndTime().getTime() === pEndTime.getTime()) {
            foundWorkEvents.splice(i, 1); // remove it from the array
            matched = true;
            break;
          }
        }

        if (this.hasDeclined(personalEvent)) {
          Logger.log(`ignoring event for "${personalEvent.getTitle()}", it's cancelled.`);
          continue;
        }

        if (matched) {
          Logger.log(`ignoring event for "${personalEvent.getTitle()}", already exists at the right time: ${pStartTime} - ${pEndTime}`);
          continue;
        }
      }

      if (personalEvent.isAllDayEvent()) {
        continue; // Do nothing if the event is an all-day or multi-day event. This script only syncs hour-based events
      }

      // if the secondary event does not exist in the primary calendar, create it, skipping weekends
      const day = personalEvent.getStartTime().getDay();
      if (day === 1 || day === 2 || day === 3 || day === 4 || day === 5) {
        const newEvent = workCal.createEvent(workEventPlaceholderTitle, personalEvent.getStartTime(), personalEvent.getEndTime());

        const desc: TargetDescription = { baseEventId: personalEventId };
        newEvent.setDescription(JSON.stringify(desc));

        newEvent.setVisibility(CalendarApp.Visibility.PRIVATE); // set blocked time as private appointments in work calendar
        newEvent.removeAllReminders(); // so you don't get double notifications. Delete this if you want to keep the default reminders for your newly created primary calendar events

        Logger.log(`created new blocking event for "${personalEvent.getTitle()}": ${newEvent.getId()} ${newEvent.getTitle()} @ ${newEvent.getStartTime()} - ${newEvent.getEndTime()}`);
      }
    }

    // if a primary event previously created no longer exists in the secondary calendar, delete it
    for (const workEvents of Object.values(syncedWorkEventsByPersonalEventId)) {
      for (const workEvent of workEvents) {
        const personalId = JSON.parse(workEvent.getDescription()).baseEventId;
        Logger.log(`deleting work event that matches "${personalCal.getEventById(personalId).getTitle()}": ${workEvent.getId()} ${workEvent.getTitle()} @ ${workEvent.getStartTime()} - ${workEvent.getEndTime()}`);
        workEvent.deleteEvent();
      }
    }
  }
}
