import {useLocalSearchParams} from 'expo-router';import {Screen,Card,Copy,Badge} from '../../src/ui';import {useSession} from '../../src/session';
export default function ComingSoon(){const {topic}=useLocalSearchParams<{topic:string}>();const {t}=useSession();return <Screen title={t(topic||'comingSoon')}><Badge status="comingSoon"/><Card><Copy>{t('comingSoonCopy')}</Copy></Card></Screen>;}
