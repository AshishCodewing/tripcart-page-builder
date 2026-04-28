import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        // sizes — sm: 36×20px, default (md): 44×24px
        "data-[size=sm]:h-5 data-[size=sm]:w-9",
        "data-[size=default]:h-6 data-[size=default]:w-11",
        // track colors
        "data-checked:bg-[#17b26a] data-unchecked:bg-[#e2e8f0] dark:data-unchecked:bg-input",
        // disabled
        "data-disabled:cursor-not-allowed data-disabled:opacity-[.32]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(10,13,18,0.1),0px_1px_2px_-1px_rgba(10,13,18,0.1)] transition-transform data-unchecked:translate-x-0 group-data-[size=sm]/switch:size-4 group-data-[size=sm]/switch:data-checked:translate-x-4 group-data-[size=default]/switch:size-5 group-data-[size=default]/switch:data-checked:translate-x-5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
