import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Palette } from '@/constants/colors';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: string;
};

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon name={icon} color={Palette.neutral[400]} size={40} style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  icon: {
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.neutral[700],
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: Palette.neutral[600],
    textAlign: 'center',
    lineHeight: 20,
  },
});
