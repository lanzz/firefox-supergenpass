const controller = {
    form: undefined,
    inputs: {},

    init() {
        console.group('Initializing options controller');
        try {
            this.form = document.getElementById('options-form');
            this.inputs.len = document.getElementById('option-len');
            this.inputs.secret = document.getElementById('option-secret');
            this.inputs.submit = document.getElementById('options-submit');
            this.form.addEventListener('submit', ev => this.submit(ev));
            this.inputs.len.addEventListener('input', ev => this.markDirty());
            this.inputs.len.addEventListener('change', ev => this.markDirty());
            this.inputs.secret.addEventListener('input', ev => this.markDirty());
            this.inputs.secret.addEventListener('change', ev => this.markDirty());
            messageController.sendGetOptions();
            console.debug('Options controller initialized');
        } finally {
            console.groupEnd();
        }
    },

    markDirty() {
        this.inputs.submit.disabled = false;
    },

    submit(ev) {
        ev.preventDefault();
        console.group('Submitting options form');
        try {
            messageController.sendUpdateOptions({
                len: this.inputs.len.value,
                secret: this.inputs.secret.value,
            })
        } finally {
            console.groupEnd();
        }
        window.close();
        return false;
    },

    populateForm(options) {
        console.debug('Populating options form');
        this.inputs.len.value = options.len;
        this.inputs.secret.value = options.secret;
        this.inputs.submit.disabled = true;
    },
};

const messageController = {
    port: undefined,

    init() {
        console.group('Initializing options message controller');
        try {
            this.port = browser.runtime.connect({name: 'options'});
            this.port.onMessage.addListener(message => this.handle(message));
            console.debug('Options message controller initialized');
        } finally {
            console.groupEnd();
        }
    },

    handle({type, ...message}) {
        switch (type) {
            case 'options':
                console.group('Received message: options');
                try {
                    controller.populateForm(message);
                } finally {
                    console.groupEnd();
                }
                break;
            default:
                console.group(`Received unexpected message: ${type}`);
                console.dir(message);
                console.groupEnd();
        }
    },

    sendGetOptions() {
        console.group('Sending message: get-options');
        try {
            this.port.postMessage({type: 'get-options'});
        } finally {
            console.groupEnd();
        }
    },

    sendUpdateOptions(options) {
        console.group('Sending message: update-options');
        try {
            this.port.postMessage({
                type: 'update-options',
                ...options,
            });
        } finally {
            console.groupEnd();
        }
    },
};

window.addEventListener('load', () => {
    console.group('Initializing options page');
    try {
        messageController.init();
        controller.init();
    } finally {
        console.groupEnd();
    }
});
