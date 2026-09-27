import { Toast } from "@base-ui/react/toast";
import { XIcon } from "lucide-react";

/**
 * Short notes on what an action did that the circuit itself does not show - a copy, what a paste
 * could not use - in one corner of the window. The viewport is a live region, so a screen reader
 * hears each note too. One note at a time: a newer one replaces the last.
 *
 * A note stays until it is dismissed or replaced, never on a timer: someone who reads slowly, or
 * reaches it with a screen reader or the keyboard, still finds it there.
 */
const toastManager = Toast.createToastManager();

/**
 * @param {!string} title
 * @param {undefined|!string=} description
 */
function notify(title, description = undefined) {
  toastManager.close();
  toastManager.add({ title, description });
}

function Toasts() {
  return (
    <Toast.Provider toastManager={toastManager} timeout={0} limit={1}>
      <Toast.Portal>
        <Toast.Viewport className="app-toasts">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className="app-toast">
      <Toast.Content className="app-toast-content">
        <Toast.Title className="app-toast-title" />
        <Toast.Description className="app-toast-description" />
      </Toast.Content>
      <Toast.Close className="app-toast-close" aria-label="Dismiss">
        <XIcon aria-hidden="true" />
      </Toast.Close>
    </Toast.Root>
  ));
}

export { Toasts, notify };
