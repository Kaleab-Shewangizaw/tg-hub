import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Txt } from '@/components/ui';
import { useSession } from '@/lib/session';
import { serif, useTheme } from '@/lib/theme';

export default function Welcome() {
  const t = useTheme();
  const session = useSession();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'sign-in') await session.signIn(email.trim(), password);
      else await session.signUp(name.trim(), email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const input = { borderColor: t.lineStrong, color: t.ink, backgroundColor: t.surface };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 10 }}>
            <View style={[styles.logo, { backgroundColor: t.accent }]}>
              <Txt style={{ color: t.onAccent, fontSize: 22 }}>◆</Txt>
            </View>
            <Txt style={{ fontFamily: serif, fontSize: 34, lineHeight: 40, fontWeight: '600' }}>Show up for your channel, at your own pace.</Txt>
            <Txt tone="muted">A calm activity map for your Telegram channel, with streaks that respect rest days and gentle reminders.</Txt>
          </View>

          <Card>
            <Txt tone="title">{mode === 'sign-in' ? 'Sign in' : 'Create your profile'}</Txt>
            {error ? (
              <Txt tone="small" accessibilityRole="alert" style={{ color: t.amber, fontWeight: '600' }}>
                {error}
              </Txt>
            ) : null}
            {mode === 'sign-up' ? (
              <TextInput style={[styles.input, input]} placeholder="Your name" placeholderTextColor={t.ink3} value={name} onChangeText={setName} accessibilityLabel="Your name" autoComplete="name" />
            ) : null}
            <TextInput
              style={[styles.input, input]}
              placeholder="Email"
              placeholderTextColor={t.ink3}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              accessibilityLabel="Email"
            />
            <TextInput
              style={[styles.input, input]}
              placeholder={mode === 'sign-up' ? 'Password (10+ characters)' : 'Password'}
              placeholderTextColor={t.ink3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              accessibilityLabel="Password"
            />
            <Button title={mode === 'sign-in' ? 'Sign in' : 'Create profile'} onPress={submit} loading={busy} disabled={busy} />
            <Button
              kind="quiet"
              title={mode === 'sign-in' ? 'New here? Create a profile' : 'I already have a profile'}
              onPress={() => {
                setError(null);
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              }}
            />
          </Card>

          <Button kind="quiet" title="Explore the demo" onPress={session.startDemo} />
          <Txt tone="small" style={{ textAlign: 'center' }}>
            The demo uses a sample channel and is clearly marked. Nothing is sent anywhere.
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },
  logo: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
});
