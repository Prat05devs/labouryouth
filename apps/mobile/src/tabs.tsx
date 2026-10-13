import {Ionicons} from '@expo/vector-icons';
import {ColorValue,Platform} from 'react-native';
import {colors,fonts,IconName} from './ui';

// One tab bar style for guest, hirer and worker modes: outline icons at rest, filled when selected.
export const tabOptions={
 headerShown:false,
 tabBarActiveTintColor:colors.trust,
 tabBarInactiveTintColor:colors.quiet,
 tabBarLabelStyle:{fontFamily:fonts.bodyBold,fontSize:11},
 tabBarStyle:{backgroundColor:colors.white,borderTopColor:colors.line,...(Platform.OS==='android'?{height:64,paddingBottom:8,paddingTop:6}:{})},
 sceneStyle:{backgroundColor:colors.canvas}
};
export function tabIcon(name:string){
 return ({focused,color,size}:{focused:boolean;color:ColorValue;size:number})=><Ionicons name={(focused?name:name+'-outline') as IconName} size={size} color={color as string}/>;
}
