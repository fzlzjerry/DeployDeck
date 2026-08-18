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
        <AlertDialog.Overlay className="modal-overlay z-40" />
        <AlertDialog.Content className="modal-content fixed top-1/2 left-1/2 z-50 w-[min(420px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-bg p-5 outline-none">
          <AlertDialog.Title className="text-[15px] font-semibold tracking-[-0.015em]">
            {confirm?.title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 max-w-[48ch] text-[13px] leading-5 text-muted">
            {confirm?.body}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
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
