// components/Logo.tsx
type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size, className }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="La 30"
      style={size ? { width: size, height: size } : undefined}
      className={`object-contain ${className || ''}`}
      onError={(e) => {
        const target = e.currentTarget;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (supabaseUrl && !target.src.includes(supabaseUrl)) {
          target.src = `${supabaseUrl}/storage/v1/object/public/assets/logo.svg`;
        }
      }}
    />
  );
}