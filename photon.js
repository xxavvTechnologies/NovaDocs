class PhotonClient {
    constructor() {
        this.client = new Photon.LoadBalancing.Client();
        this.callbacks = {};
        this.setupCallbacks();
    }

    setupCallbacks() {
        this.client.onStateChange = this.handleStateChange.bind(this);
        this.client.onEvent = this.handleEvent.bind(this);
    }

    handleStateChange(state) {
        switch (state) {
            case Photon.LoadBalancing.Constants.State.Connected:
                console.log("Connected to Photon");
                break;
            case Photon.LoadBalancing.Constants.State.Joined:
                if (this.callbacks.onJoinedRoom) {
                    this.callbacks.onJoinedRoom();
                }
                break;
        }
    }

    handleEvent(code, data, actorNr) {
        switch(code) {
            case 1: // Document changes
                if (this.callbacks.onDocumentUpdate) {
                    this.callbacks.onDocumentUpdate(data);
                }
                break;
            case 2: // Cursor updates
                if (this.callbacks.onCursorUpdate) {
                    this.callbacks.onCursorUpdate(data, actorNr);
                }
                break;
        }
    }

    connect() {
        this.client.connectToRegionMaster("us");
    }

    joinDocument(docId) {
        this.client.joinRoom(docId);
    }

    sendDocumentUpdate(content) {
        if (this.client.isJoinedToRoom()) {
            this.client.raiseEvent(1, {
                content: content,
                timestamp: Date.now()
            });
        }
    }

    sendCursorUpdate(position) {
        if (this.client.isJoinedToRoom()) {
            this.client.raiseEvent(2, {
                position: position,
                timestamp: Date.now()
            });
        }
    }

    setCallbacks(callbacks) {
        this.callbacks = callbacks;
    }
}