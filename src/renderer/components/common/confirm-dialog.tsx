import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";

export function ConfirmDialog() {
  const confirm = useUiStore((state) => state.confirm);
  const close = useUiStore((state) => state.closeConfirm);
  const [pending, setPending] = useState(false);

  useEffect(() => setPending(false), [confirm]);

  const destructive = confirm?.intent === "danger" || confirm?.actionLabel.toLowerCase() === "delete";

  return (
    <AlertDialog.Root open={Boolean(confirm)} onOpenChange={(open) => !open && !pending && close()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="modal-overlay" />
        <AlertDialog.Content className="modal-content fixed top-1/2 left-1/2 w-[min(440px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 rounded-panel bg-panel p-5 outline-none">
        <AlertDialog.Title className="text-section font-semibold text-ink">
            {confirm?.title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 max-w-[52ch] text-pretty text-dense text-muted">
            {confirm?.body}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" disabled={pending}>Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={destructive ? "danger" : "default"}
                loading={pending}
                disabled={pending}
                onClick={async (event) => {
                  event.preventDefault();
                  setPending(true);
                  try {
                    await confirm?.onConfirm();
                    close();
                  } catch (error) {
                    toast.error(errorMessage(error));
                    setPending(false);
                  }
                }}
              >
                {confirm?.actionLabel ?? "Continue"}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
