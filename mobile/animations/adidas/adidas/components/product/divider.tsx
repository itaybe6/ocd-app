import { cn } from "@/src/shared/lib/utils/cn";
import { StyleSheet, View } from "react-native";

type DividerProps = {
  className?: string;
};

const Divider = ({ className }: DividerProps) => {
  return (
    <View
      className={cn("bg-neutral-400", className)}
      style={{ height: StyleSheet.hairlineWidth }}
    />
  );
};

export default Divider;
