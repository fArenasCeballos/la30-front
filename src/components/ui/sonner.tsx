/* eslint-disable react-refresh/only-export-components */
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white/95 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-slate-900 group-[.toaster]:border group-[.toaster]:border-slate-200/90 group-[.toaster]:shadow-xl group-[.toaster]:shadow-slate-900/8 group-[.toaster]:rounded-2xl group-[.toaster]:p-3.5 group-[.toaster]:text-xs group-[.toaster]:font-sans",
          description: "group-[.toast]:text-slate-500 text-xs",
          actionButton:
            "group-[.toast]:bg-slate-900 group-[.toast]:text-white group-[.toast]:rounded-xl group-[.toast]:text-xs group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-600 group-[.toast]:rounded-xl group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:bg-white group-[.toast]:border group-[.toast]:border-slate-200 group-[.toast]:text-slate-400 hover:group-[.toast]:text-slate-700",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
