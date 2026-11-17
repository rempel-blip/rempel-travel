// Standard consumer Google Maps iframe. No Maps JavaScript API key is used.
export function googleEmbedURL(query){const u=new URL('https://www.google.com/maps');u.searchParams.set('q',query);u.searchParams.set('output','embed');u.searchParams.set('hl','ru');u.searchParams.set('z','12');return u.href;}
export function googleOpenURL(query){const u=new URL('https://www.google.com/maps/search/');u.searchParams.set('api','1');u.searchParams.set('query',query);return u.href;}
