MOD_NONE = 0;
MOD_ALT = 1;
MOD_CTRL = 2;
MOD_META = 4;
MOD_SHIFT = 8;

const controller = {
    form: undefined,
    inputs: {},

    init() {
        console.debug('Initializing password controller');
        this.form = document.getElementById('password-form');
        this.inputs.password = document.getElementById('password');
        this.form.addEventListener('submit', ev => this.submit(ev));
        this.inputs.password.addEventListener('blur', ev => this.focusPassword(ev));
        document.body.addEventListener('keyup', ev => this.keyHandler(ev));
        this.focusPassword();
        console.debug('Password controller initialized');
    },

    focusPassword(ev) {
        setTimeout(() => this.inputs.password.focus(), 0);
    },

    mods(ev) {
        return (ev.altKey? MOD_ALT: MOD_NONE) |
               (ev.ctrlKey? MOD_CTRL: MOD_NONE) |
               (ev.metaKey? MOD_META: MOD_NONE) |
               (ev.shiftKey? MOD_SHIFT: MOD_NONE);
    },

    keyHandler(ev) {
        const combo = [ev.key, this.mods(ev)];
        switch (combo) {
            case ['Escape', MOD_NONE]:
                messageController.sendCancel();
                ev.preventDefault();
                return false;
        }
    },

    submit(ev) {
        ev.preventDefault();
        if (!this.inputs.password.value.length) {
            console.debug('Empty input, not setting master password');
            return false;
        }
        console.debug('Setting master password');
        messageController.sendSetMasterPassword(this.inputs.password.value);
        this.form.reset();
        return false;
    },
};

const messageController = {
    port: undefined,

    init() {
        console.debug('Initializing password message controller');
        this.port = browser.runtime.connect({name: 'password'});
        console.debug('Password message controller initialized');
    },

    sendSetMasterPassword(password) {
        console.debug('Sending message: set-master-password');
        this.port.postMessage({
            type: 'set-master-password',
            password: password,
        });
    },

    sendCancel() {
        console.debug('Sending message: cancel');
        this.port.postMessage({
            type: 'cancel',
        });
    }
};

window.addEventListener('load', () => {
    console.debug('Initializing password dialog');
    messageController.init();
    controller.init();
    console.debug('Password dialog initialized');
});
