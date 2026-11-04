//made this for the demo
// it has the street addresses for the back of each postcard

export interface PlaceAddress {
  street: string;
  cityLine: string;
}

//from nellie's api
export const PLACE_ADDRESSES: Record<string, PlaceAddress> = {
  'p-pike': { street: '85 Pike St', cityLine: 'Seattle, WA 98101' },
  'p-sam': { street: '1300 1st Ave', cityLine: 'Seattle, WA 98101' },
  'p-kerry': { street: '211 W Highland Dr', cityLine: 'Seattle, WA 98119' },
  'p-jazz': { street: '2033 6th Ave', cityLine: 'Seattle, WA 98121' },
  'p-park': { street: '3801 Discovery Park Blvd', cityLine: 'Seattle, WA 98199' },
  'p-chihuly': { street: '305 Harrison St', cityLine: 'Seattle, WA 98109' },
  'p-cafe': { street: '1234 Coffee Ln', cityLine: 'Seattle, WA 98101' },
};
