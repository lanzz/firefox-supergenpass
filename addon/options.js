const controller = {
    form: undefined,
    inputs: {},

    init() {
        console.debug('Initializing options controller');
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
    },

    markDirty() {
        this.inputs.submit.disabled = false;
    },

    submit(ev) {
        ev.preventDefault();
        console.debug('Submitting options form');
        messageController.sendUpdateOptions({
            len: this.inputs.len.value,
            secret: this.inputs.secret.value,
        });
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
        console.debug('Initializing options message controller');
        this.port = browser.runtime.connect({name: 'options'});
        this.port.onMessage.addListener(message => this.handle(message));
        console.debug('Options message controller initialized');
    },

    handle({type, ...message}) {
        switch (type) {
            case 'options':
                console.debug('Received message: options');
                controller.populateForm(message);
                break;
            default:
                console.group(`Received unexpected message: ${type}`);
                console.dir(message);
                console.groupEnd();
        }
    },

    sendGetOptions() {
        console.debug('Sending message: get-options');
        this.port.postMessage({type: 'get-options'});
    },

    sendUpdateOptions(options) {
        console.debug('Sending message: update-options');
        this.port.postMessage({
            type: 'update-options',
            ...options,
        });
    },
};

window.addEventListener('load', () => {
    console.debug('Initializing options page');
    messageController.init();
    controller.init();
    console.debug('Options page initialized');
});
