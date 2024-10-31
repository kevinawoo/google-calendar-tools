export const Config = {
  BlockWorkCalWithPersonEventPlaceholders: {
    Enabled: true,
    WorkCalID: 'workEmail@work.com',
    PersonalCalID: 'personalEmail@gmail.com',
    WorkEventPlaceholderTitle: 'Busy',
    WorkDayStartHour: 8,
    WorkDayEndHour: 19
  },
  EndingSoonEvents: {
    Enabled: true,
    PrimaryCalID: 'personalEmail@gmail.com', // id of the primary calendar to pull events from
    EndNotifCalID: 'domain_CalID@group.calendar.google.com', // id of the secondary calendar to push to
    LookAheadDays: 1 // days to look ahead and create events for
  },
  SunsetWalkEvents: {
    Enabled: true,
    DaysToCreate: 14,
    Latitude: 0.0, // your latitude
    Longitude: 0.0 // your longitude
  },
  Cleanup: {
    Enabled: false,
    CalID: '123@group.calendar.google.com', // id of the calendar to clean up
    Regex: /Busy/,  // regex match event title
    Days: 14        // days to look ahead and create events for
  }
};
