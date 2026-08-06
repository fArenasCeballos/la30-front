---
name: ui-component
description: Crear componentes de UI reutilizables en la30-front usando shadcn/ui (Radix UI + CVA), Tailwind CSS 4, Framer Motion y Lucide Icons. Seguir las convenciones del design system del proyecto.
---

# Skill: UI Component Development

## Cuándo usar este skill
- Crear nuevos componentes de interfaz.
- Modificar componentes shadcn/ui existentes.
- Implementar formularios con React Hook Form + Zod.
- Agregar animaciones con Framer Motion.
- Construir layouts responsivos.

## Design System

### Componentes base (shadcn/ui)
Ubicación: `src/components/ui/`

Componentes disponibles:
`alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `chart`, `checkbox`, `command`, `dialog`, `drawer`, `dropdown-menu`, `emoji-picker`, `form`, `input`, `label`, `logo`, `popover`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `tooltip`

### Agregar nuevos componentes shadcn/ui
```bash
npx shadcn@latest add [componente]
```
Configuración en `components.json`:
```json
{
  "style": "default",
  "tailwind": { "config": "", "css": "src/index.css", "baseColor": "zinc" },
  "aliases": { "components": "@/components", "utils": "@/lib/utils" }
}
```

### Utilidad de clases condicionales
```typescript
import { cn } from "@/lib/utils";
// cn() combina clsx + tailwind-merge

<div className={cn(
  "rounded-lg border p-4",
  isActive && "border-primary bg-primary/5",
  isError && "border-destructive"
)} />
```

## Patrones de UI del Proyecto

### Card con CRUD
```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-lg font-semibold">Título</CardTitle>
    <CardDescription>Descripción opcional</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* contenido */}
  </CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="outline" onClick={onCancel}>Cancelar</Button>
    <Button onClick={onSave}>Guardar</Button>
  </CardFooter>
</Card>
```

### Dialog/Modal
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Título del Modal</DialogTitle>
      <DialogDescription>Descripción</DialogDescription>
    </DialogHeader>
    {/* Contenido */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      <Button onClick={handleSave}>Guardar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Formulario con validación
```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

const schema = z.object({
  name: z.string().min(1, "Requerido"),
  price: z.coerce.number().positive("Debe ser positivo"),
});

function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", price: 0 },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit">Guardar</Button>
      </form>
    </Form>
  );
}
```

### Tabla con datos
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Nombre</TableHead>
      <TableHead className="text-right">Precio</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item) => (
      <TableRow key={item.id}>
        <TableCell className="font-medium">{item.name}</TableCell>
        <TableCell className="text-right">{formatPrice(item.price)}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Animaciones (Framer Motion)

```tsx
import { motion, AnimatePresence } from "framer-motion";

// Fade in
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>

// Lista animada
<AnimatePresence>
  {items.map((item) => (
    <motion.div
      key={item.id}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
    />
  ))}
</AnimatePresence>
```

## Iconos (Lucide React)

```tsx
import { ShoppingCart, Plus, Trash2, Edit, Search } from "lucide-react";

<ShoppingCart className="h-4 w-4" />
<Button size="icon" variant="ghost"><Plus className="h-4 w-4" /></Button>
```

Catálogo completo: https://lucide.dev/icons

## Responsividad

- **Mobile**: Base (default classes).
- **Tablet**: `sm:` y `md:` breakpoints (Kiosko, Cocina).
- **Desktop**: `lg:` y `xl:` breakpoints (Dashboard, Admin).

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

## Loading States

```tsx
// Skeleton loader
<div className="space-y-4">
  <Skeleton className="h-12 w-full max-w-md" />
  <div className="grid grid-cols-2 gap-4">
    {[1, 2, 3, 4].map((i) => (
      <Skeleton key={i} className="aspect-square w-full" />
    ))}
  </div>
</div>

// Loading spinner en botón
<Button disabled={isLoading}>
  {isLoading ? "Guardando..." : "Guardar"}
</Button>
```
