import React from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Platform,
} from 'react-native';

export interface MentionCandidate {
  id: string;
  nombre: string;
  es_profesor?: boolean;
}

interface MentionDropdownProps {
  candidates: MentionCandidate[];
  onSelect: (member: MentionCandidate) => void;
  colors: Record<string, string>;
}

/**
 * Dropdown que muestra la lista filtrada de miembros para autocompletar @menciones.
 * Se renderiza encima del input del chat.
 */
export const MentionDropdown = ({ candidates, onSelect, colors }: MentionDropdownProps) => {
  if (candidates.length === 0) return null;

  const renderItem = ({ item }: { item: MentionCandidate }) => {
    const initials = (item.nombre || '?')
      .split(' ')
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');

    return (
      <TouchableOpacity
        style={[dropdownStyles.item, { borderBottomColor: colors.borderLight || '#E2E8F0' }]}
        onPress={() => onSelect(item)}
        activeOpacity={0.6}
      >
        <View style={[dropdownStyles.avatar, { backgroundColor: item.es_profesor ? '#6366F1' : '#3B82F6' }]}>
          <Text style={dropdownStyles.avatarText}>{initials}</Text>
        </View>
        <View style={dropdownStyles.info}>
          <Text style={[dropdownStyles.name, { color: colors.textPrimary || '#0F172A' }]} numberOfLines={1}>
            {item.nombre}
          </Text>
          {item.es_profesor && (
            <Text style={[dropdownStyles.badge, { color: '#6366F1' }]}>Profesor</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[dropdownStyles.container, {
      backgroundColor: colors.surface || '#FFFFFF',
      borderColor: colors.border || '#E2E8F0',
      ...(Platform.OS === 'web' ? { boxShadow: '0px -4px 16px rgba(0, 0, 0, 0.12)' } : {}),
    }]}>
      <FlatList
        data={candidates.slice(0, 6)}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        style={dropdownStyles.list}
      />
    </View>
  );
};

const dropdownStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 4,
    overflow: 'hidden',
    maxHeight: 240,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  list: {
    maxHeight: 240,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
  },
});
