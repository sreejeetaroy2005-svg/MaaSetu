import { startSyncEngine } from './sync';

// Started before the first render: the queue and the connection watcher must
// already be live when a screen asks whether a change is still on this phone.
startSyncEngine();
