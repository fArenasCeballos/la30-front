// components/Logo.tsx
type LogoProps = {
  size?: number;
  className?: string;
};

const url = import.meta.env.VITE_SUPABASE_URL

export function Logo({ size, className }: LogoProps) {
  return (
    <img
      src={`${url}/storage/v1/object/public/assets/logo.svg`}
      alt="La 30"
      style={size ? { width: size, height: size } : undefined}
      className={`object-contain ${className || ''}`}
    />
  );
}