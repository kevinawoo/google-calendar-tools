export const config: ConfigType = {
  BlockCalendars: [
    {
      Enabled: true,
      FromCalId: 'person.email@gmail.com',
      ToCalId: 'work.email@my-company.com',
      Days: 14, // default

      TitlePlaceholder: 'Busy', // XOR CopyEventTitle: true
      WorkDayStartHour: 8, // 8am
      WorkDayEndHour: 24, // midnight
      SkipWeekends: true,
    }
    // ... add more calendars to mirror
  ],
  EndingSoonEvents: {
    Enabled: false,
    PrimaryCalID: '', // id of the primary calendar to pull events from
    EndNotifCalID: 'aaabbbccc@group.calendar.google.com', // id of the secondary calendar to push to
    LookAheadDays: 1 // days to look ahead and create events for
  },
  SunsetWalkEvents: {
    Enabled: false,
    DaysToCreate: 14,
    Latitude: 0.0, // your latitude
    Longitude: 0.0 // your longitude
  },
  Cleanup: [
    {
      Enabled: true,
      CalID: 'aaabbbcccc@group.calendar.google.com', // id of the secondary calendar to push to
      Regex: /^Busy$/,
      Days: 14 // days to look ahead and clean up
    }
  ]
};
