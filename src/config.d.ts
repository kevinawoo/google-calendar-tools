type ConfigType = {
  BlockCalendars: (BlockCalWithPlaceHolderType | BlockCalWithFromTitle)[];

  EndingSoonEvents: {
    LookAheadDays: number;
    Enabled: boolean;
    PrimaryCalID: string;
    EndNotifCalID: string;
  };
  SunsetWalkEvents: {
    DaysToCreate: number;
    Enabled: boolean;
    Latitude: number;
    Longitude: number;
  };
  Cleanup: Cleanup[];
};

type BaseBlockCalendar = {
  Enabled: boolean;
  FromCalId: string;
  ToCalId: string;

  // Days defaults to 14
  // Note that this extends the execution time, which you might run into Google App limits
  // ... set higher with caution
  Days: number;

  WorkDayStartHour: number;
  WorkDayEndHour: number;
  SkipWeekends?: boolean;
  SyncLocationField?: boolean;
};

type BlockCalWithPlaceHolderType = BaseBlockCalendar & {
  CopyEventTitle?: never;
  TitlePlaceholder: string;
};

type BlockCalWithFromTitle = BaseBlockCalendar & {
  CopyEventTitle: boolean;
  TitlePlaceholder?: never;
};

type Cleanup = {
  Enabled: boolean;
  CalID: string;
  Regex: RegExp;
  Days: number; // how many days ahead to clean up (default 30)
};
