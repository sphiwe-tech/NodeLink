import config from '../../config.js'

import { debugLog, encodeTrack, makeRequest } from '../utils.js'

/**
 * checks For Identifier & source prefix, returns result If 
 * @param {string} identifier 
 * @returns {RegExpExecArray | boolean | null} returns a false or null if check failed And a RegExpExecArray if matches it.
 */
function check(identifier) {
    const jsRegexp = /https?:\/\/(?:www\.)?(?:jiosaavn\.com|saavn\.com)?(?:[^?]+)(?<type>song|album|featured|artist)([^?]+)\/(?<identifier>[a-zA-Z0-9-_]+)/g
    return config.search.sources.jiosaavn && (identifier.startsWith('jssearch:') || identifier.startsWith('jsrec:') || jsRegexp.exec(identifier))
}

/**
 * @todo
 */
async function loadFrom(type, identifier, url) {

    if (!type || !identifier) {
        debugLog('loadtracks', 4, { type: 3, loadType: 'error', sourceName: 'jioSaavn', query: url, message: `Unable to extract url type & identifier from ${url}, Received type: ${type}, identifier: ${identifier}` })

        return {
            loadType: "error",
            data: {
                message: `Unable to extract url type & identifier from ${url}, Received type: ${type}, identifier: ${identifier}`,
                severity: 'fault',
                cause: "Data extraction didn't give required keys/values (type, identifier)"
            }
        }
    }

    let endpoint;
    const limit = config.options.maxSearchResults >= 50 ? 50 : config.options.maxSearchResults;

    switch (type) {
        case "song": {
            endpoint = `/songs/${encodeURIComponent(identifier)}`
            break
        }
        case "album": {
            endpoint = `/albums?id=${encodeURIComponent(identifier)}`
            break
        }
        case "featured": {
            endpoint = `/playlists?id=${encodeURIComponent(identifier)}&page=0&limit=${limit}`
            break
        }
        default: {
            debugLog('loadtracks', 4, { type: 3, loadType: type[1], sourceName: 'JioSaavn', query: identifier, message: 'No matches found.' })

            return {
                loadType: 'empty',
                data: {}
            }
        }
    }

    debugLog('loadtracks', 4, { type: 1, loadType: type[1], sourceName: 'JioSaavn', query: url })

    const req = await makeRequest(`${config.search.sources.jiosaavn.apiBaseUrl}${endpoint}`, {
        headers: {
            "Content-Type": "application/json"
        }
    })

    if (req.error || req.statusCode !== 200) {
        const errMsg = req.error ? req.error.message : `JioSaavn ${req.statusCode === 404 ? `No matches Found.` : `Returned invalid`} status code: ${req.statusCode}`

        debugLog('loadtracks', 4, { type: 3, loadType: type[1], sourceName: 'Spotify', query: url, message: errMsg })

        return {
            loadType: 'empty',
            data: {}
        }
    }

    const reqBody = req.body

    if (!(body?.data || body?.success))
        return {
            loadType: "error",
            data: {
                message: `Something went Wrong while requesting to JioSaavn, Response: ${reqBody.data}`,
                severity: 'fault',
                cause: 'Unknown'
            }
        }
    
    
}

async function retrieveStream(identifier, title) {

    const audioQualityRange = [];
    switch (config.audio.quality) {
        case "lowest": {
            audioQualityRange.push("12kbps")
            break
        }
        case "low": {
            audioQualityRange.push("48kbps")
            break
        }
        case "medium": {
            // If 160kbps is not available, then 96kbps is used, filtered later. (Creating medium quality)
            audioQualityRange.push("160kbps", "96kbps")
            break
        }
        case "high": {
            audioQualityRange.push("320kbps")
            break
        }
        default: {
            audioQualityRange.push("320kbps")
            break
        }
    }

    const req = await makeRequest(`${config.search.sources.jiosaavn.apiBaseUrl}/songs/${encodeURIComponent(identifier)}`, {
        headers: {
            "Content-Type": "application/json"
        }
    })

    if (req.error || req.statusCode !== 200) {
        const errMsg = req.error ? req.error.message : `JioSaavn ${req.statusCode === 404 ? `Requested Song Not found` : `Returned invalid`} status code: ${req.statusCode}`

        debugLog('retrieveStream', 4, { type: 2, sourceName: 'JioSaavn', query: title, message: errMsg })

        return {
            exception: {
                message: errMsg,
                severity: 'fault',
                cause: 'Unknown'
            }
        }
    }

    const reqBody = req.body

    if (!reqBody?.success)
        return {
            exception: {
                message: `Something went Wrong while requesting to JioSaavn, Response: ${reqBody.data}`,
                severity: 'fault',
                cause: 'Unknown'
            }
        }

    const fetchedTrack = reqBody.data[0]
    const selectedDownloadUrl = audioQualityRange.find((quality) => fetchedTrack.downloadUrl.find((urlObj) => urlObj.quality === quality)).url || fetchedTrack.downloadUrl[fetchedTrack?.downloadUrl?.length - 1]?.url

    if (!selectedDownloadUrl) {
        debugLog('retrieveStream', 4, { type: 3, sourceName: 'JioSaavn', query: title, message: 'Track Not playable, no playable stream url found.' })
        return {
            exception: {
                message: 'Track Not playable, no playable stream url found.',
                severity: 'fault',
                cause: 'Unknown'
            }
        }
    }

    return {
        url: selectedDownloadUrl,
        protocol: 'https',
        format: 'audio/mp4' // Not Preforming Another Request to get the format.
    }
}
/**
 * Search for songs based on the provided identifier
 * @param {string} identifier 
 * @see https://saavn.dev/docs#/tag/search/GET/api/search/songs Data/Response Structure
 */
async function search(identifier) {

    return new Promise(async (resolve) => {

        debugLog('search', 4, { type: 1, sourceName: 'JioSaavn', query: identifier })

        // 50 is the More then enough, Default 200 is too much for response body and increases the response body's size
        const limit = config.options.maxSearchResults >= 50 ? 50 : config.options.maxSearchResults;

        // not using global search as of now, cause we just need songs, That endpoint returns artists,playlists,albums,song types. 
        const { body } = await makeRequest(`${config.search.sources.jiosaavn.apiBaseUrl}/search/songs?query=${encodeURI(identifier)}&limit=${limit}&page=0`, {
            headers: {
                "Content-Type": "application/json"
            }
        })

        if (!(body?.data || body?.success) || body.data.results.length === 0 || body.data.total === 0) {
            debugLog('search', 4, { type: 3, sourceName: 'JioSaavn', query: identifier, message: 'No matches found.' })

            return resolve({
                loadType: "empty",
                data: {}
            })
        }

        const tracks = []

        body.data.results.forEach((songItem) => {

            const track = {
                identifier: songItem.id,
                isSeekable: true,
                author: songItem.artists.primary ? songItem.artists.primary.map((artist) => artist.name).join(', ') : null,
                length: songItem.duration * 1000,
                isStream: false,
                position: 0,
                title: songItem.name,
                uri: songItem.url,
                artworkUrl: songItem.image[songItem.image.length - 1]?.url ?? null,
                isrc: null,
                sourceName: 'jiosaavn'
            }

            tracks.push({
                encoded: encodeTrack(track),
                info: track,
                pluginInfo: {}
            })
        })

        if (tracks.length > 50) tracks.length = 50;

        debugLog('search', 4, { type: 2, loadType: 'track', sourceName: 'JioSaavn', tracksLen: tracks.length, query: identifier })

        return resolve({
            loadType: "search",
            data: tracks
        })
    })
}

export default {
    loadFrom,
    retrieveStream,
    search
}