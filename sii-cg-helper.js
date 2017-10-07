const request = require('request'),
    debug = require('debug')('http');

const baseApiUrl = 'https://coding-game.swat-sii.fr/api';
//const baseApiUrl = 'http://localhost:8080';

class CHARACTERS {
    /**
     * Get Warrior key
     */
    static get WARRIOR() { return 'WARRIOR'; }
    /**
     * Get Paladin key
     */
    static get PALADIN() { return 'PALADIN'; }
    /**
     * Get druid key
     */
    static get DRUID() { return 'DRUID'; }
    /**
     * Get sorcerer key
     */
    static get SORCERER() { return 'SORCERER'; }
    /**
     * Get troll key
     */
    static get TROLL() { return 'TROLL'; }
    /**
     * Get elf key
     */
    static get ELF() { return 'ELF'; }
}

class ACTIONS {
    /**
     * Get hit action key (Don't use when your opponent have his shield)
     */
    static get HIT() { return 'HIT'; }
    /**
     * Get thrust action key (Use it when your opponent have his shield)
     */
    static get THRUST() { return 'THRUST'; }
    /**
     * Get heal action key
     */
    static get HEAL() { return 'HEAL'; }
    /**
     * Get Shield action key
     */
    static get SHIELD() { return 'SHIELD'; }
}

class GAME_STATUS {
    /**
     * Waiting an other player
     */
    static get WAITING() { return 'WAITING'; }
    /**
     * Game playing
     */
    static get PLAYING() { return 'PLAYING'; }
    /**
     * Game finished
     */
    static get FINISHED() { return 'FINISHED'; }
}

class SIICgHelper {
    constructor() {
        this.me = null;
        this.opponent = null;
        this.speed = 0;
        this.gameToken = null;
    }

    /**
     * Create a new game
     * @param {string} name Name of game
     * @param {boolean} speedy Enable speedy mode
     * @param {boolean} versus Set Versus mode or IA mode
     */
    createGame(name, speedy, versus) {
        let postData = {
            name: name,
            speedy: !!speedy,
            versus: !!versus
        };

        debug('Creating game => ', postData);

        let promise = new Promise((resolve, reject) => {
            request({
                url: `${baseApiUrl}/fights`,
                method: "POST",
                json: postData
            },
                (error, resp, body) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(body);
                });
        })
            .then((data) => {
                debug('Game created %s', data.token);
                return data;
            });

        return promise;
    }

    /**
     * Join an existing game and return data when the game is started
     * @param {string} gameToken Token of the game to join
     * @param {string} playerKey Private personal token
     * @param {string} playerName Player display name
     * @param {string} character Character type (WARRIOR, PALADIN, DRUID, SORCERER)
     */
    joinGameWithCountDown(gameToken, playerKey, playerName, character) {
        let postData = {
            character: character,
            name: playerName
        };

        let promise = new Promise((resolve, reject) => {
            this.joinGame(gameToken, playerKey, playerName, character)
                .then((data) => {

                    this.gameToken = data.token;
                    this.speed = data.speed;

                    if (!this.resolveWhenGameStarted(data, resolve)) {
                        let itCheck = setInterval((() => {
                            this.getGame(gameToken, playerKey)
                                .then((data) => {
                                    this.resolveWhenGameStarted(data, resolve, itCheck);
                                })
                                .catch(reject)
                        }).bind(this), 1000);
                    }

                })
                .catch(reject);
        });

        return promise;
    }

    /**
     * Join an existing game
     * @param {string} gameToken Token of the game to join
     * @param {string} playerKey Private personal token
     * @param {string} playerName Player display name
     * @param {string} character Character type (WARRIOR, PALADIN, DRUID, SORCERER)
     */
    joinGame(gameToken, playerKey, playerName, character) {
        let postData = {
            character: character,
            name: playerName
        };

        debug('Join game (%s)', gameToken);

        let promise = new Promise((resolve, reject) => {
            request({
                url: `${baseApiUrl}/fights/${gameToken}/players/${playerKey}`,
                method: "POST",
                json: postData
            },
                (error, resp, body) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(body);
                });
        })
            .then((data) => {
                debug('Game joined. Status %s', data.status);
                return data;
            });

        return promise;
    }

    resolveWhenGameStarted(data, resolve, itCheck) {

        if (data.status === GAME_STATUS.PLAYING) {
            if (itCheck) {
                clearInterval(itCheck);
            }

            this.me = data.me;
            this.oponent = data.foe;

            setTimeout(() => {
                resolve(data);
            }, data.countDown);

            return true;
        }
        return false
    }

    /**
     * Get the current game state
     * @param {string} gameToken Token of the game
     * @param {string} playerKey Private personal token
     */
    getGame(gameToken, playerKey) {
        let promise = new Promise((resolve, reject) => {
            request({
                url: `${baseApiUrl}/fights/${gameToken}/players/${playerKey}`,
                method: "GET",
                json: true
            },
                (error, resp, body) => {
                    if (error || resp.statusCode >= 400) {
                        reject(error || resp);
                        return;
                    }

                    this.me = body.me;
                    this.oponent = body.foe;

                    resolve(body);
                });
        });

        return promise;
    }

    /**
     * Make an action
     * @param {string} gameToken Token of the game
     * @param {string} playerKey Private personal token
     * @param {string} actionName Name of action
     * @param {number} delay Milliseconds before send action
     */
    makeAction(gameToken, playerKey, actionName, delay) {

        debug('Making action: %s', actionName);
        let promise = new Promise((resolve, reject) => {
            setTimeout(() => {
                request({
                    url: `${baseApiUrl}/fights/${gameToken}/players/${playerKey}/actions/${actionName}`,
                    method: "POST"
                },
                    (error, resp, body) => {
                        if (resp.statusCode >= 400) {
                            debug('Status error %d', resp.statusCode);
                        }
                        if (error || resp.statusCode >= 400) {
                            reject(error || resp);
                            return;
                        }

                        let data = JSON.parse(body);

                        this.me = data.me;
                        this.oponent = data.foe;

                        debug('You: ', this.me.healthPoints);
                        debug('Opponent: ', this.oponent.healthPoints);

                        resolve(data);
                    });
            }, delay || 0);
        })
            .then((body) => {
                debug('Action made');
                return body;
            });

        return promise;
    }

    /**
     * Make an action and return data when the cool down is finished
     * @param {string} gameToken Token of the game
     * @param {string} playerKey Private personal token
     * @param {string} actionName Name of action
     * @param {number} delay Milliseconds before send action
     */
    makeActionWithCoolDown(gameToken, playerKey, actionName, delay) {
        let promise = new Promise((resolve, reject) => {
            this.makeAction(gameToken, playerKey, actionName, delay)
                .then((data) => {
                    let action = this.me.character.actions.find(action => action.name === actionName);
                    return this.wait(action.coolDown * this.speed, data);
                })
                .then(resolve)
                .catch(reject);

        });
        return promise;
    }

    /**
     * Waik X milliseconds
     * @param {number} time Waiting time in milliseconds
     */
    wait(time, ...params) {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, time, params);
        });
    }

    /**
     * Generate a unique PlayerKey
     */
    generateUniquePlayerKey() {
        return (Math.random() + 1).toString(36).substring(2,10);
    }
}

module.exports.SIICgHelper = new SIICgHelper();
module.exports.CHARACTERS = CHARACTERS;
module.exports.ACTIONS = ACTIONS;
module.exports.GAME_STATUS = GAME_STATUS;
