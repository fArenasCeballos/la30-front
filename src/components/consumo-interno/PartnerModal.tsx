import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  createPartner,
  updatePartner,
} from "@/lib/internalConsumptionService";
import type { InternalPartner } from "@/types";

interface PartnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPartner: InternalPartner | null;
  onSaved: () => void;
}

export function PartnerModal({
  open,
  onOpenChange,
  editingPartner,
  onSaved,
}: PartnerModalProps) {
  const [name, setName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingPartner) {
      setName(editingPartner.name);
      setDocumentId(editingPartner.document_id ?? "");
      setPhone(editingPartner.phone ?? "");
      setEmail(editingPartner.email ?? "");
    } else {
      setName("");
      setDocumentId("");
      setPhone("");
      setEmail("");
    }
  }, [editingPartner, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("El nombre del socio es obligatorio");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPartner) {
        await updatePartner(editingPartner.id, {
          name: name.trim(),
          document_id: documentId.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
        });
        toast.success("Socio actualizado correctamente");
      } else {
        await createPartner({
          name: name.trim(),
          document_id: documentId.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
        });
        toast.success("Socio creado exitosamente");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto rounded-[3rem] p-10 border-none shadow-strong bg-white/95 backdrop-blur-xl">
        <DialogHeader className="space-y-4 mb-8">
          <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            {editingPartner ? (
              <Pencil className="h-8 w-8" strokeWidth={2.5} />
            ) : (
              <UserPlus className="h-8 w-8" strokeWidth={2.5} />
            )}
          </div>
          <DialogTitle className="text-3xl font-black tracking-tight">
            {editingPartner ? "Editar Socio" : "Nuevo Socio"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium text-base">
            {editingPartner
              ? "Actualiza la información del socio."
              : "Registra un nuevo socio para el consumo interno."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              Nombre Completo *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Alejandro Gómez"
              className="h-14 rounded-2xl border-2 bg-accent/5 font-bold text-lg px-5"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              Documento / Cédula
            </Label>
            <Input
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="Ej: 1.098.765.432"
              className="h-14 rounded-2xl border-2 bg-accent/5 font-bold text-lg px-5"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
                Teléfono
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="3001234567"
                className="h-14 rounded-2xl border-2 bg-accent/5 font-bold text-lg px-5"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="socio@correo.com"
                className="h-14 rounded-2xl border-2 bg-accent/5 font-bold text-lg px-5"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-10 gap-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] px-8"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="h-14 flex-1 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] px-10 shadow-strong shadow-primary/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Guardando...
              </>
            ) : editingPartner ? (
              "Guardar Cambios"
            ) : (
              "Crear Socio"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
