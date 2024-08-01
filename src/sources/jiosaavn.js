import { URL } from 'node:url'

import config from '../../config.js'

import { debugLog, encodeTrack, makeRequest } from '../utils.js'
/**
 * @todo
 */
async function loadFrom() {}

/**
 * @todo 
 */
async function retrieveStream() {}
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

        if(!(body?.data || body?.success) || body.data.results.length === 0 || body.data.total === 0) {
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

        if(tracks.length > 50) tracks.length = 50;

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