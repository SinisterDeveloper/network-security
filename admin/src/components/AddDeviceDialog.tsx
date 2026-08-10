import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegisterDevice } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
const HEX_1024 = /^[0-9A-Fa-f]{1024}$/;
const HEX_64 = /^[0-9A-Fa-f]{64}$/;

export const addDeviceSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(64),
  mac: z.string().trim().regex(MAC_REGEX, "MAC must be AA:BB:CC:DD:EE:FF"),
  puf: z.string().trim().regex(HEX_1024, "PUF must be 1024 hex chars (512B)"),
  firmwareHash: z.string().trim().regex(HEX_64, "Firmware hash must be 64 hex chars (sha256)"),
});

export type AddDeviceFormValues = z.infer<typeof addDeviceSchema>;

interface AddDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: Partial<AddDeviceFormValues>;
}

export function AddDeviceDialog({ open, onOpenChange, defaults }: AddDeviceDialogProps) {
  const { toast } = useToast();
  const mutation = useRegisterDevice();

  const form = useForm<AddDeviceFormValues>({
    resolver: zodResolver(addDeviceSchema),
    defaultValues: {
      name: "",
      mac: "",
      puf: "",
      firmwareHash: "",
      ...defaults,
    },
  });

  useEffect(() => {
    if (open && defaults) {
      form.reset({
        name: form.getValues("name") || "",
        mac: defaults.mac ?? "",
        puf: defaults.puf ?? "",
        firmwareHash: defaults.firmwareHash ?? "",
      });
    }
    if (!open) form.reset({ name: "", mac: "", puf: "", firmwareHash: "", ...defaults } as AddDeviceFormValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaults?.mac, defaults?.puf, defaults?.firmwareHash]);

  const onSubmit = async (values: AddDeviceFormValues) => {
    try {
      const device = await mutation.mutateAsync(values);
      toast({ title: `Device ${device.id} created`, description: device.name });
      onOpenChange(false);
      form.reset();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create device";
      const isAuth = (e as { status?: number }).status === 401;
      toast({
        title: isAuth ? "Unauthorized" : "Create failed",
        description: isAuth ? "Set VITE_ADMIN_KEY to match server ADMIN_KEY" : msg,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add ESP device</DialogTitle>
          <DialogDescription>
            Creates via <span className="font-mono">POST /client/device</span>. PUF 1024 hex, firmwareHash 64 hex.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="sensor-01" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mac">MAC address</Label>
            <Input id="mac" placeholder="AA:BB:CC:DD:EE:FF" className="font-mono" {...form.register("mac")} />
            {form.formState.errors.mac && (
              <p className="text-xs text-destructive">{form.formState.errors.mac.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="puf">PUF (1024 hex)</Label>
            <Input id="puf" placeholder="1024 hex chars" className="font-mono text-xs" {...form.register("puf")} />
            {form.formState.errors.puf && (
              <p className="text-xs text-destructive">{form.formState.errors.puf.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="firmwareHash">Firmware hash (64 hex sha256)</Label>
            <Input
              id="firmwareHash"
              placeholder="64 hex chars"
              className="font-mono text-xs"
              {...form.register("firmwareHash")}
            />
            {form.formState.errors.firmwareHash && (
              <p className="text-xs text-destructive">{form.formState.errors.firmwareHash.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
