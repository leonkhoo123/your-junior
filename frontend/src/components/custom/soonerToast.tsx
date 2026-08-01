import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import { Toaster, type ToasterProps } from 'sonner';
import { useTheme } from '@/components/theme-provider';

const SuccessIcon = () => (
    <div className="text-primary flex items-center justify-center">
        <CircleCheck size={22} />
    </div>
);

const ErrorIcon = () => (
    <div className="text-destructive flex items-center justify-center">
        <CircleX size={22} />
    </div>
);

const InfoIcon = () => (
    <div className="text-primary flex items-center justify-center">
        <Info size={22} />
    </div>
);

const WarningIcon = () => (
    <div className="text-amber-500 flex items-center justify-center">
        <TriangleAlert size={22} />
    </div>
);

export const SonnerToastCustom = (props: ToasterProps) => {
  const { theme } = useTheme();
  return (
    <Toaster
      position="bottom-center"
      offset={100}
      duration={2500}
      theme={theme}
      icons={{
        success: <SuccessIcon />,
        error: <ErrorIcon />,
        info: <InfoIcon />,
        warning: <WarningIcon />,
      }}
      {...props}
    />
  );
};
