import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
          <ArrowLeft size={20} color="#ffffff" />
          <Text className="text-white font-bold ml-2">Retour</Text>
        </TouchableOpacity>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Text className="text-white text-2xl font-extrabold mb-6">Confidentialité</Text>
        <Text className="text-zinc-200 text-base font-bold mb-2">Regarder les vidéos</Text>
        <Text className="text-zinc-400 leading-6 mb-6">
          Les vidéos publiques peuvent être regardées sans créer de compte. Un compte est demandé pour les actions qui nécessitent une identité, comme publier, aimer ou suivre un créateur.
        </Text>
        <Text className="text-zinc-200 text-base font-bold mb-2">Mesure des visites</Text>
        <Text className="text-zinc-400 leading-6 mb-6">
          Pour compter les adresses IP uniques, le serveur Netlify transforme l’adresse IP reçue en une empreinte HMAC avec une clé secrète. L’adresse IP brute n’est pas enregistrée dans la table de statistiques. Le navigateur n’envoie qu’une visite par session et respecte le réglage « Ne pas suivre » lorsqu’il est activé.
        </Text>
        <Text className="text-zinc-400 leading-6">
          Une adresse IP n’identifie pas toujours une personne : plusieurs personnes peuvent partager la même adresse, et une personne peut en utiliser plusieurs. Le total affiché dans l’administration est donc un nombre d’IP uniques estimé, pas un décompte exact de personnes.
        </Text>
      </ScrollView>
    </View>
  );
}
