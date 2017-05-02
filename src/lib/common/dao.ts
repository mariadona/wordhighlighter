///<reference path="../../../node_modules/@types/chrome/index.d.ts" />
///<reference path="dictionaryEntry.ts" />
///<reference path="logger.ts" />
///<reference path="settings.ts" />

/**
 * Data Access Object.
 * Handles all interactions with the storage.
 *
 * TODO: unit test
 */
class DAO {

    private DEFAULT_TIMEOUT: number = 3;

    private storage: chrome.storage.StorageArea = chrome.storage.sync;

    getDictionary(callback: (dictionary: Array<DictionaryEntry>) => void): void {
        let self: DAO = this;
        self.storage.get('dictionary', function(result: { dictionary: Array<DictionaryEntry> }) {
            if (result !== undefined) {
                callback(self.deserializeDictionary(result.dictionary));
            } else {
                WHLogger.log('Switching to local storage');
                self.storage = chrome.storage.local;
                self.getDictionary(callback);
            }
        });
    }

    getSettings(callback: (settings: Settings) => void): void {
        let self: DAO = this;
        self.storage.get('settings', function(result: { settings: any }) {
            if (result !== undefined) {
                callback(self.deserializeSettings(result.settings));
            } else {
                WHLogger.log('Switching to local storage');
                self.storage = chrome.storage.local;
                self.getSettings(callback);
            }
        });
    }

    init() {
        let self: DAO = this;
        chrome.storage.sync.get('anything', function(syncVerification) {
            if (syncVerification !== undefined) {
                WHLogger.log('Using sync storage');
                // TODO: migrate data from local store.
            } else {
                WHLogger.log('Using local storage');
                self.storage = chrome.storage.local;
            }
            self.storage.get('dictionary', function(result: { dictionary: Array<DictionaryEntry> }) {
                if (!result.dictionary) {
                    self.storage.set({ dictionary: [] }, function() {
                        WHLogger.log('Initialized the dictionary');
                    });
                }
            });
            self.storage.get('idSequenceNumber', function(result: { idSequenceNumber: number }) {
                if (!result.idSequenceNumber) {
                    self.storage.set({ idSequenceNumber: 1 }, function() {
                        WHLogger.log('Initialized the id sequence');
                    });
                }
            });
            self.storage.get('settings', function(result: { settings: Settings }) {
                if (!result.settings) {
                    let settings = new Settings();
                    settings.enableHighlighting = true;
                    settings.enablePageStats = true;
                    settings.timeout = self.DEFAULT_TIMEOUT;
                    self.storage.set({ settings: self.serializeSettings(settings) }, function() {
                        WHLogger.log('Initialized the settings');
                    });
                }
            });
        });
    }

    addEntry(value: string, description: string, strictMatch: boolean, callback: (newEntry: DictionaryEntry) => void): void {
        let self: DAO = this;
        self.storage.get(['dictionary', 'idSequenceNumber'], (result: { dictionary: Array<any>, idSequenceNumber: number }) => {
            let now: Date = new Date();
            let entry = {
                id: result.idSequenceNumber,
                value: value,
                description: description,
                strictMatch: strictMatch,
                createdAt: now,
                updatedAt: now
            };
            result.dictionary.push(entry);
            self.storage.set({ dictionary: result.dictionary, idSequenceNumber: result.idSequenceNumber + 1 }, function() {
                WHLogger.log('Word ' + entry.value + ' has been added to the storages');
                callback(self.serializeDictionaryEntry(entry));
            });
        });
    }

    saveDictionary(dictionary: Array<DictionaryEntry>, callback: () => void): void {
        let self: DAO = this;
        let needsToGenerateIds = dictionary.filter(function(dictionaryEntry: DictionaryEntry) {
            return !dictionaryEntry.id;
        });
        if (needsToGenerateIds.length === 0) {
            self.storage.set({ dictionary: self.serializeDictionary(dictionary) }, function() {
                WHLogger.log('Saved dictionary');
                callback();
            });
            return;
        }
        self.storage.get('idSequenceNumber', function(result: { idSequenceNumber: number }) {
            let idSequenceNumber = result.idSequenceNumber;
            needsToGenerateIds.forEach(function(dictionaryEntry: DictionaryEntry) {
                dictionaryEntry.id = idSequenceNumber++;
            });
            self.storage.set({ idSequenceNumber: idSequenceNumber, dictionary: self.serializeDictionary(dictionary) }, function() {
                WHLogger.log('Saved the dictionary. New id sequence number: ' + idSequenceNumber);
                callback();
            });
        });
    }

    saveSettings(settings: Settings, callback: () => void): void {
        this.storage.set({ settings: this.serializeSettings(settings) }, function() {
            WHLogger.log('Saved the settings');
            callback();
        });
    }

    private deserializeDictionary(input: Array<any>): Array<DictionaryEntry> {
        if (input === null) {
            return null;
        }
        return input.map(this.deserializeDictionaryEntry);
    }

    private deserializeDictionaryEntry(input: any): DictionaryEntry {
        return new DictionaryEntry(
            input['id'],
            input['value'],
            input['description'],
            input['createdAt'],
            input['updatedAt'],
            input['strictMatch']
        );
    }

    private deserializeSettings(input: any): Settings {
        let settings: Settings = new Settings();
        settings.timeout = input.timeout;
        settings.enableHighlighting  = input.enableHighlighting;
        if (input.enablePageStats === undefined) {
            // Was created before stats was implemented.
            input.enablePageStats = true;
        }
        settings.enablePageStats = input.enablePageStats;
        return settings;
    }

    private serializeDictionary(input: Array<DictionaryEntry>): Array<any> {
        if (input === null) {
            return null;
        }
        return input.map(this.serializeDictionaryEntry);
    }

    private serializeDictionaryEntry(input: DictionaryEntry): any {
        return {
            id: input.id,
            value: input.value,
            description: input.description,
            createdAt: input.createdAt,
            updatedAt: input.updatedAt,
            strictMatch: input.strictMatch
        };
    }

    private serializeSettings(input: Settings) {
        return {
            timeout: input.timeout,
            enableHighlighting: input.enableHighlighting,
            enablePageStats: input.enablePageStats
        };
    }
}
