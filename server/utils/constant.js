export const SONG_QUEUE_LOCATION = "config/queue.json";
export const SPOTIFY_TOKEN_LOCATION = "config/spotify.json";
export const AUTH_TOKEN_LOCATION = "config/authToken.json";

export const JIP_SAVAN_RADIO = "https://www.jiosaavn.com/api.php?__call=webradio.getSong&stationid=NiYjzMrmuVqKYqAAaBcKigB3s1AGJnIYPxS6MooHriPI59HL2nhJuQ__&k=20&next=1&api_version=4&_format=json&_marker=0&ctx=web6dot0"

export const JIO_SAVAN_TOP50 = "https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=1134543272&api_version=4&_format=json&_marker=0&ctx=web6dot0"

export const JIO_SAVAN_SONG_SEARCH = (songName) => `https://www.jiosaavn.com/api.php?p=1&q=${songName}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=1&__call=search.getResults`