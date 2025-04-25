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

  WorkDayStartHour: number;
  WorkDayEndHour: number;
  SkipWeekends?: boolean;
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
