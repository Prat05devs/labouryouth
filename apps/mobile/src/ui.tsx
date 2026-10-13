import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Animated,KeyboardAvoidingView,Modal,Platform,Pressable,RefreshControl,ScrollView,StyleProp,StyleSheet,Switch,Text,TextInput,TextInputProps,TextStyle,View,ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {MotionView,useReducedMotion} from './motion';
import {useSession} from './session';

// Design tokens and native-style components (docs/MOBILE_WIREFRAMES.md, Decision 30).
export type IconName=React.ComponentProps<typeof Ionicons>['name'];
export const fonts={display:'Anton_400Regular',body:'OpenSans_400Regular',medium:'OpenSans_500Medium',bodyBold:'OpenSans_600SemiBold',bold:'OpenSans_700Bold'};
// Decision 29 palette. canvas is the screen background so white cards read as raised surfaces.
export const colors={canvas:'#F4F3EF',paper:'#FBFAF7',white:'#FFFFFF',raised:'#F1F0EC',soft:'#EAF0FF',line:'#E3E1DB',lineStrong:'#C7D6FF',quiet:'#626970',ink:'#0B0C0C',text:'#1C1E20',muted:'#555D64',onInk:'#FFFFFF',trust:'#1F4FD1',trustInk:'#1A3E9E',trustDeep:'#122A6B',trustSoft:'#EAF0FF',trustMid:'#C7D6FF',care:'#0B7A6E',careInk:'#08635A',careSoft:'#E2F5F0',careMid:'#A6E2D4',courage:'#F08A24',courageInk:'#9C4708',courageSoft:'#FFF0E0',courageMid:'#FFD2A3',warmth:'#D23C6E',warmthInk:'#A42451',warmthSoft:'#FDE9EF',warmthMid:'#F7BCCF',sun:'#F6BE3B',sunInk:'#76560F',sunSoft:'#FFF6DA',calm:'#6A4BD6',calmInk:'#5034AD',calmSoft:'#F0EBFF',calmMid:'#D5C9FB',accent:'#1F4FD1',accentText:'#1A3E9E',onAccent:'#FFFFFF',danger:'#B3261E',dangerBg:'#FBEAE8'};
export const space={xs:4,sm:8,md:12,lg:16,xl:20,xxl:24,xxxl:32};
export const radius={sm:8,md:12,lg:16,xl:20,full:999};
export const type=StyleSheet.create({
 largeTitle:{fontFamily:fonts.bold,fontSize:28,lineHeight:36,color:colors.ink,letterSpacing:-0.3},
 title:{fontFamily:fonts.bold,fontSize:20,lineHeight:27,color:colors.ink},
 headline:{fontFamily:fonts.bodyBold,fontSize:17,lineHeight:23,color:colors.ink},
 body:{fontFamily:fonts.body,fontSize:16,lineHeight:23,color:colors.text},
 callout:{fontFamily:fonts.body,fontSize:15,lineHeight:21,color:colors.muted},
 footnote:{fontFamily:fonts.body,fontSize:13,lineHeight:18,color:colors.muted},
 caption:{fontFamily:fonts.medium,fontSize:12,lineHeight:16,color:colors.quiet},
 overline:{fontFamily:fonts.bodyBold,fontSize:13,lineHeight:18,color:colors.quiet,letterSpacing:0.4,textTransform:'uppercase'}
});
const shadow={shadowColor:colors.trustDeep,shadowOpacity:0.06,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:1};
export const tones=[
 {soft:colors.trustSoft,strong:colors.trust},{soft:colors.careSoft,strong:colors.care},{soft:colors.courageSoft,strong:colors.courageInk},
 {soft:colors.warmthSoft,strong:colors.warmth},{soft:colors.sunSoft,strong:colors.sunInk},{soft:colors.calmSoft,strong:colors.calm}
];
export const toneAt=(i:number)=>tones[((i%tones.length)+tones.length)%tones.length];

export function Txt({variant='body',style,children,...rest}:React.ComponentProps<typeof Text>&{variant?:keyof typeof type}){return <Text style={[type[variant],style]} {...rest}>{children}</Text>;}
export function Copy({children,strong=false,style}:{children:React.ReactNode;strong?:boolean;style?:StyleProp<TextStyle>}){return <Text style={[type.callout,strong&&{fontFamily:fonts.bodyBold,color:colors.ink},style]}>{children}</Text>;}

// Scroll container. Tab roots pass safeTop and a large title; stack screens rely on the native header.
// footer renders a sticky action bar above the home indicator and rises with the keyboard.
export function Screen({title,subtitle,headerRight,children,footer,safeTop=false,onRefresh,refreshing=false,gap=space.lg,padded=true}:{title?:string;subtitle?:string;headerRight?:React.ReactNode;children:React.ReactNode;footer?:React.ReactNode;safeTop?:boolean;onRefresh?:()=>void;refreshing?:boolean;gap?:number;padded?:boolean}){
 const insets=useSafeAreaInsets();const box=useRef<View>(null);const [offset,setOffset]=useState(0);
 return <View ref={box} onLayout={()=>box.current?.measureInWindow((_x,y)=>setOffset(y))} style={{flex:1,backgroundColor:colors.canvas}}>
  <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={offset}>
   <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}
    refreshControl={onRefresh?<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.trust} colors={[colors.trust]}/>:undefined}
    contentContainerStyle={[{paddingTop:(safeTop?insets.top:0)+(title?space.sm:space.lg),paddingBottom:footer?space.xxl:space.xxxl+(safeTop?0:insets.bottom),gap},padded&&{paddingHorizontal:space.lg},{width:'100%',maxWidth:720,alignSelf:'center'}]}>
    {title?<View style={styles.largeHead}><View style={{flex:1,gap:2}}><Text accessibilityRole="header" style={type.largeTitle}>{title}</Text>{subtitle?<Text style={type.callout}>{subtitle}</Text>:null}</View>{headerRight}</View>:null}
    {children}
   </ScrollView>
   {footer?<View style={[styles.footer,{paddingBottom:Math.max(insets.bottom,space.md)}]}>{footer}</View>:null}
  </KeyboardAvoidingView>
 </View>;
}

type ButtonVariant='primary'|'secondary'|'ghost'|'danger'|'success';
export function Button({label,onPress,variant='primary',secondary=false,size='lg',icon,disabled=false,style,flex}:{label:string;onPress:()=>void|Promise<unknown>;variant?:ButtonVariant;secondary?:boolean;size?:'lg'|'md'|'sm';icon?:IconName;disabled?:boolean;style?:StyleProp<ViewStyle>;flex?:boolean}){
 const [busy,setBusy]=useState(false);const reduced=useReducedMotion();const scale=useRef(new Animated.Value(1)).current;
 const kind:ButtonVariant=secondary?'secondary':variant;const v=buttonVariants[kind];const h=size==='lg'?52:size==='md'?44:36;
 const press=(value:number)=>{if(reduced)return;Animated.spring(scale,{toValue:value,useNativeDriver:true,speed:40,bounciness:0,isInteraction:false}).start();};
 return <Animated.View style={[{transform:[{scale}]},flex&&{flex:1},style]}><Pressable onPressIn={()=>press(0.97)} onPressOut={()=>press(1)} hitSlop={size==='sm'?6:0} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy}
  onPress={async()=>{setBusy(true);try{await onPress();}finally{setBusy(false);}}}
  style={({pressed})=>[styles.button,{minHeight:h,paddingHorizontal:size==='sm'?14:18,backgroundColor:v.bg,borderColor:v.border},(disabled)&&{opacity:0.45},pressed&&{opacity:0.8}]}>
  {busy?<ActivityIndicator color={v.fg}/>:<>{icon?<Ionicons name={icon} size={size==='sm'?16:19} color={v.fg}/>:null}<Text numberOfLines={2} style={[styles.buttonText,{color:v.fg,fontSize:size==='sm'?14:16}]}>{label}</Text></>}
 </Pressable></Animated.View>;
}
const buttonVariants:Record<ButtonVariant,{bg:string;fg:string;border:string}>={
 primary:{bg:colors.trust,fg:colors.onInk,border:colors.trust},secondary:{bg:colors.white,fg:colors.trustInk,border:colors.trustMid},
 ghost:{bg:'transparent',fg:colors.trustInk,border:'transparent'},danger:{bg:colors.dangerBg,fg:colors.danger,border:colors.dangerBg},success:{bg:colors.care,fg:colors.onInk,border:colors.care}
};
export function TextLink({label,onPress,color=colors.trustInk}:{label:string;onPress:()=>void;color?:string}){return <Pressable accessibilityRole="link" hitSlop={10} onPress={onPress} style={({pressed})=>({minHeight:44,justifyContent:'center',opacity:pressed?0.6:1})}><Text style={{fontFamily:fonts.bodyBold,fontSize:15,color}}>{label}</Text></Pressable>;}
export function IconButton({icon,label,onPress,tone='plain',badge=false}:{icon:IconName;label:string;onPress:()=>void;tone?:'plain'|'soft';badge?:boolean}){return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={onPress} style={({pressed})=>[styles.iconButton,tone==='soft'&&{backgroundColor:colors.white,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line},pressed&&{opacity:0.6}]}><Ionicons name={icon} size={22} color={colors.ink}/>{badge?<View style={styles.dot}/>:null}</Pressable>;}

export function Field({label,error,hint,icon,prefix,secureTextEntry,style,...props}:TextInputProps&{label:string;error?:string;hint?:string;icon?:IconName;prefix?:string}){
 const {t}=useSession();const [hidden,setHidden]=useState(!!secureTextEntry);const [focus,setFocus]=useState(false);
 return <View style={{gap:6}}><Text style={styles.label}>{label}</Text>
  <View style={[styles.input,focus&&{borderColor:colors.trust,borderWidth:1.5},!!error&&{borderColor:colors.danger,borderWidth:1.5},props.multiline&&{alignItems:'flex-start',minHeight:96}]}>
   {icon?<Ionicons name={icon} size={19} color={colors.quiet} style={props.multiline?{marginTop:14}:undefined}/>:null}
   {prefix?<Text style={[type.body,{color:colors.muted}]}>{prefix}</Text>:null}
   <TextInput accessibilityLabel={label} accessibilityHint={error||hint} placeholderTextColor={colors.quiet} secureTextEntry={hidden} onFocus={e=>{setFocus(true);props.onFocus?.(e);}} onBlur={e=>{setFocus(false);props.onBlur?.(e);}} style={[styles.inputText,props.multiline&&{textAlignVertical:'top',paddingTop:13},style]} {...props}/>
   {secureTextEntry?<Pressable accessibilityRole="button" accessibilityLabel={t(hidden?'showPassword':'hidePassword')} hitSlop={10} onPress={()=>setHidden(!hidden)}><Ionicons name={hidden?'eye-outline':'eye-off-outline'} size={21} color={colors.quiet}/></Pressable>:null}
  </View>
  {error?<Text accessibilityLiveRegion="polite" style={[type.footnote,{color:colors.danger,fontFamily:fonts.bodyBold}]}>{error}</Text>:hint?<Text style={type.footnote}>{hint}</Text>:null}
 </View>;
}

export function Card({children,onPress,style,tone,padded=true,accessibilityLabel}:{children:React.ReactNode;onPress?:()=>void;style?:StyleProp<ViewStyle>;tone?:'trust'|'care'|'courage'|'warmth'|'calm'|'sun';padded?:boolean;accessibilityLabel?:string}){
 const bg=tone?colors[`${tone}Soft` as keyof typeof colors]:colors.white;const base=[styles.card,{backgroundColor:bg},tone&&{borderColor:'transparent'},padded&&{padding:space.lg},style];
 if(onPress)return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({pressed})=>[...base,pressed&&{opacity:0.75}]}>{children}</Pressable>;
 return <View style={base}>{children}</View>;
}
export function Section({title,action,onAction,children,gap=space.md}:{title?:string;action?:string;onAction?:()=>void;children?:React.ReactNode;gap?:number}){
 return <MotionView style={{gap}}>{title?<View style={styles.sectionHead}><Text accessibilityRole="header" style={type.title}>{title}</Text>{action&&onAction?<TextLink label={action} onPress={onAction}/>:null}</View>:null}{children}</MotionView>;
}
export function ListGroup({title,children,footer}:{title?:string;children:React.ReactNode;footer?:string}){
 const items=React.Children.toArray(children).filter(Boolean);
 return <View style={{gap:space.sm}}>{title?<Text style={[type.overline,{paddingHorizontal:space.xs}]}>{title}</Text>:null}<View style={[styles.card,{overflow:'hidden'}]}>{items.map((child,i)=><View key={i}>{i>0?<View style={styles.separator}/>:null}{child}</View>)}</View>{footer?<Text style={[type.footnote,{paddingHorizontal:space.xs}]}>{footer}</Text>:null}</View>;
}
export function ListRow({icon,iconColor=colors.trust,iconBg=colors.trustSoft,title,subtitle,value,onPress,right,chevron=!!onPress,destructive=false,disabled=false}:{icon?:IconName;iconColor?:string;iconBg?:string;title:string;subtitle?:string;value?:string;onPress?:()=>void;right?:React.ReactNode;chevron?:boolean;destructive?:boolean;disabled?:boolean}){
 const body=<>{icon?<View style={[styles.rowIcon,{backgroundColor:destructive?colors.dangerBg:iconBg}]}><Ionicons name={icon} size={19} color={destructive?colors.danger:iconColor}/></View>:null}
  <View style={{flex:1,gap:2}}><Text style={[type.headline,{fontSize:16},destructive&&{color:colors.danger}]}>{title}</Text>{subtitle?<Text style={type.footnote} numberOfLines={2}>{subtitle}</Text>:null}</View>
  {value?<Text style={[type.callout,{maxWidth:'45%'}]} numberOfLines={1}>{value}</Text>:null}{right}{chevron?<Ionicons name="chevron-forward" size={18} color={colors.quiet}/>:null}</>;
 if(!onPress)return <View style={styles.row}>{body}</View>;
 return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={({pressed})=>[styles.row,pressed&&{backgroundColor:colors.raised},disabled&&{opacity:0.5}]}>{body}</Pressable>;
}
export function SwitchRow({icon,title,subtitle,value,onValueChange,disabled}:{icon?:IconName;title:string;subtitle?:string;value:boolean;onValueChange:(v:boolean)=>void;disabled?:boolean}){
 return <ListRow icon={icon} iconColor={value?colors.care:colors.quiet} iconBg={value?colors.careSoft:colors.raised} title={title} subtitle={subtitle} right={<Switch accessibilityLabel={title} value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{true:colors.care,false:colors.line}} thumbColor={colors.white}/>}/>;
}

export function Chip({label,selected,onPress,icon}:{label:string;selected?:boolean;onPress:()=>void;icon?:IconName}){
 return <Pressable accessibilityRole="button" accessibilityState={{selected:!!selected}} hitSlop={{top:4,bottom:4}} onPress={onPress} style={({pressed})=>[styles.chip,selected&&styles.chipOn,pressed&&{opacity:0.7}]}>
  {icon?<Ionicons name={icon} size={16} color={selected?colors.onInk:colors.text}/>:null}<Text style={[styles.chipText,selected&&{color:colors.onInk}]}>{label}</Text>
 </Pressable>;
}
export function Tag({label}:{label:string}){return <View style={[styles.chip,{backgroundColor:colors.raised,borderColor:colors.raised,minHeight:32}]}><Text style={[styles.chipText,{fontSize:13}]}>{label}</Text></View>;}
// Horizontal chip row that bleeds to the screen edges like native filter bars.
export function ChipScroller({children,bleed=true}:{children:React.ReactNode;bleed?:boolean}){return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={bleed?{marginHorizontal:-space.lg}:undefined} contentContainerStyle={{gap:space.sm,paddingHorizontal:bleed?space.lg:0}}>{children}</ScrollView>;}
export function ChipWrap({children}:{children:React.ReactNode}){return <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{children}</View>;}
export function Segmented<T extends string>({options,value,onChange}:{options:{value:T;label:string;icon?:IconName}[];value:T;onChange:(v:T)=>void}){
 return <View accessibilityRole="tablist" style={styles.segment}>{options.map(o=>{const on=o.value===value;return <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{selected:on}} onPress={()=>onChange(o.value)} style={[styles.segmentItem,on&&styles.segmentOn]}>{o.icon?<Ionicons name={o.icon} size={17} color={on?colors.ink:colors.muted}/>:null}<Text numberOfLines={1} style={[styles.segmentText,on&&{color:colors.ink}]}>{o.label}</Text></Pressable>;})}</View>;
}
export function OptionRow({label,subtitle,selected,onPress,multi=false,icon}:{label:string;subtitle?:string;selected:boolean;onPress:()=>void;multi?:boolean;icon?:IconName}){
 return <Pressable accessibilityRole={multi?'checkbox':'radio'} accessibilityState={{checked:selected}} onPress={onPress} style={({pressed})=>[styles.option,selected&&styles.optionOn,pressed&&{opacity:0.75}]}>
  {icon?<View style={[styles.rowIcon,{backgroundColor:selected?colors.white:colors.trustSoft}]}><Ionicons name={icon} size={19} color={colors.trust}/></View>:null}
  <View style={{flex:1,gap:2}}><Text style={[type.headline,{fontSize:16}]}>{label}</Text>{subtitle?<Text style={type.footnote}>{subtitle}</Text>:null}</View>
  <Ionicons name={multi?(selected?'checkbox':'square-outline'):(selected?'radio-button-on':'radio-button-off')} size={24} color={selected?colors.trust:colors.quiet}/>
 </Pressable>;
}
export function Stepper({label,value,onChange,min=1,max=99,suffix}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max?:number;suffix?:string}){
 const btn=(icon:IconName,next:number,can:boolean,a11y:string)=><Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={!can} onPress={()=>onChange(next)} hitSlop={4} style={({pressed})=>[styles.stepBtn,!can&&{opacity:0.35},pressed&&{backgroundColor:colors.trustMid}]}><Ionicons name={icon} size={20} color={colors.trustInk}/></Pressable>;
 return <View style={styles.stepper}><Text style={[type.headline,{flex:1,fontSize:16}]}>{label}</Text>{btn('remove',value-1,value>min,label+' -')}<Text accessibilityLiveRegion="polite" style={[type.headline,{minWidth:44,textAlign:'center'}]}>{value}{suffix?' '+suffix:''}</Text>{btn('add',value+1,value<max,label+' +')}</View>;
}
export function StepProgress({step,total,label}:{step:number;total:number;label?:string}){const {t}=useSession();
 return <View style={{gap:space.sm}} accessibilityLabel={`${step} / ${total}`}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={type.overline}>{t('step')} {step} {t('of')} {total}</Text>{label?<Text style={type.caption}>{label}</Text>:null}</View><View style={styles.track}><View style={[styles.trackFill,{width:`${Math.min(100,Math.max(4,step/total*100))}%`}]}/></View></View>;
}

const pillTone:Record<string,'success'|'info'|'warn'|'danger'|'neutral'>={COMPLETED:'success',APPROVED:'success',ACCEPTED:'success',COMPLETE:'success',ASSIGNED:'success',ACTIVE:'success',online:'success',interestSelected:'success',SELECTED:'success',EARNING:'success',SUBMITTED:'info',MATCHING:'info',OFFERING:'info',EN_ROUTE:'info',ARRIVED:'info',IN_PROGRESS:'info',SCHEDULED:'info',PAYOUT:'info',PENDING:'warn',PENDING_VERIFICATION:'warn',DRAFT:'warn',ON_HOLD:'warn',NOT_STARTED:'warn',comingSoon:'warn',EXPRESSED:'warn',CANCELLED:'danger',EXPIRED:'danger',DECLINED:'danger',WITHDRAWN:'danger',REJECTED:'danger',NO_SHOW:'danger',REPLACED:'neutral',offline:'neutral'};
const pillColors={success:[colors.careSoft,colors.careInk],info:[colors.trustSoft,colors.trustInk],warn:[colors.courageSoft,colors.courageInk],danger:[colors.dangerBg,colors.danger],neutral:[colors.raised,colors.muted]};
export function StatusPill({status,label}:{status:string;label?:string}){const {t}=useSession();const [bg,fg]=pillColors[pillTone[status]||'neutral'];
 return <View style={[styles.pill,{backgroundColor:bg}]}><View style={[styles.pillDot,{backgroundColor:fg}]}/><Text numberOfLines={1} style={[styles.pillText,{color:fg}]}>{label||t(status)}</Text></View>;
}
export const Badge=StatusPill;

export function Avatar({name,size=48,tone=0,online}:{name:string;size?:number;tone?:number;online?:boolean}){const c=toneAt(tone);
 return <View style={{width:size,height:size}}><View style={{width:size,height:size,borderRadius:size/2,backgroundColor:c.soft,alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:fonts.bold,fontSize:size*0.42,color:c.strong}}>{(name||'?').slice(0,1).toUpperCase()}</Text></View>{online!==undefined?<View style={[styles.presence,{backgroundColor:online?colors.care:colors.quiet,width:size*0.28,height:size*0.28,borderRadius:size}]}/>:null}</View>;
}
export function IconTile({icon,tone=0,size=44}:{icon:IconName;tone?:number;size?:number}){const c=toneAt(tone);return <View style={{width:size,height:size,borderRadius:size*0.3,backgroundColor:c.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={size*0.5} color={c.strong}/></View>;}

export function Banner({kind='info',text,action,onAction}:{kind?:'info'|'success'|'error'|'warn';text:string;action?:string;onAction?:()=>void}){
 const map={info:[colors.trustSoft,colors.trustInk,'information-circle'],success:[colors.careSoft,colors.careInk,'checkmark-circle'],error:[colors.dangerBg,colors.danger,'alert-circle'],warn:[colors.courageSoft,colors.courageInk,'time']} as const;const [bg,fg,icon]=map[kind];
 return <View accessibilityRole={kind==='error'?'alert':undefined} accessibilityLiveRegion="polite" style={[styles.banner,{backgroundColor:bg}]}><Ionicons name={icon} size={21} color={fg}/><Text style={[type.callout,{flex:1,color:fg}]}>{text}</Text>{action&&onAction?<Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}><Text style={{fontFamily:fonts.bold,fontSize:14,color:fg}}>{action}</Text></Pressable>:null}</View>;
}
export function ErrorBox({code,onRetry}:{code:string;onRetry?:()=>void}){const {t}=useSession();return code?<Banner kind="error" text={t(code)} action={onRetry?t('retry'):undefined} onAction={onRetry}/>:null;}
export function EmptyState({icon='file-tray-outline',title,text,action,onAction}:{icon?:IconName;title?:string;text:string;action?:string;onAction?:()=>void}){
 return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.trust}/></View>{title?<Text style={[type.headline,{textAlign:'center'}]}>{title}</Text>:null}<Text style={[type.callout,{textAlign:'center',maxWidth:320}]}>{text}</Text>{action&&onAction?<Button size="md" label={action} onPress={onAction}/>:null}</View>;
}
export function Empty({text}:{text:string}){return <EmptyState text={text}/>;}

export function Skeleton({height=16,width='100%',radius:r=radius.sm,style}:{height?:number;width?:number|`${number}%`;radius?:number;style?:StyleProp<ViewStyle>}){
 const reduced=useReducedMotion();const pulse=useRef(new Animated.Value(0.5)).current;
 useEffect(()=>{if(reduced)return;const loop=Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1,duration:650,useNativeDriver:true}),Animated.timing(pulse,{toValue:0.5,duration:650,useNativeDriver:true})]));loop.start();return()=>loop.stop();},[reduced,pulse]);
 return <Animated.View style={[{height,width,borderRadius:r,backgroundColor:colors.line,opacity:pulse},style]}/>;
}
export function SkeletonCard({count=3}:{count?:number}){const {t}=useSession();
 return <View accessibilityLabel={t('loadingShort')} style={{gap:space.md}}>{Array.from({length:count},(_,i)=><View key={i} style={[styles.card,{padding:space.lg,flexDirection:'row',gap:space.md}]}><Skeleton width={44} height={44} radius={12}/><View style={{flex:1,gap:8}}><Skeleton width="60%" height={16}/><Skeleton width="85%" height={12}/><Skeleton width="40%" height={12}/></View></View>)}</View>;
}

export function Sheet({visible,onClose,title,children,footer}:{visible:boolean;onClose:()=>void;title:string;children:React.ReactNode;footer?:React.ReactNode}){const insets=useSafeAreaInsets();const {t}=useSession();
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
  <Pressable accessibilityLabel={t('close')} style={styles.backdrop} onPress={onClose}/>
  <View style={[styles.sheet,{paddingBottom:Math.max(insets.bottom,space.lg)}]}><View style={styles.grabber}/><View style={styles.sectionHead}><Text accessibilityRole="header" style={type.title}>{title}</Text><IconButton icon="close" label={t('close')} onPress={onClose}/></View><View style={{gap:space.lg}}>{children}</View>{footer?<View style={{marginTop:space.xl}}>{footer}</View>:null}</View>
 </KeyboardAvoidingView></Modal>;
}
export function Divider(){return <View style={styles.separator}/>;}
export function Fact({icon,label,value}:{icon:IconName;label:string;value:string}){return <View style={styles.fact}><Ionicons name={icon} size={19} color={colors.trust}/><Text style={type.caption}>{label}</Text><Text style={[type.headline,{fontSize:15}]}>{value}</Text></View>;}
export function FactGrid({children}:{children:React.ReactNode}){return <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.md}}>{children}</View>;}
export function MetaLine({icon,text,color=colors.muted}:{icon:IconName;text:string;color?:string}){return <View style={{flexDirection:'row',alignItems:'center',gap:5,flexShrink:1}}><Ionicons name={icon} size={14} color={color}/><Text numberOfLines={1} style={[type.footnote,{color,flexShrink:1}]}>{text}</Text></View>;}

export const styles=StyleSheet.create({
 largeHead:{flexDirection:'row',alignItems:'center',gap:space.md,paddingBottom:space.xs},
 footer:{paddingHorizontal:space.lg,paddingTop:space.md,backgroundColor:colors.white,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line,gap:space.sm},
 button:{borderRadius:radius.md,borderWidth:1,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,paddingVertical:8},
 buttonText:{fontFamily:fonts.bodyBold,textAlign:'center',flexShrink:1},
 iconButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
 dot:{position:'absolute',top:10,right:11,width:9,height:9,borderRadius:5,backgroundColor:colors.warmth,borderWidth:1.5,borderColor:colors.white},
 label:{fontFamily:fonts.bodyBold,fontSize:14,color:colors.text},
 input:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radius.md,minHeight:52,paddingHorizontal:14},
 inputText:{flex:1,minHeight:50,fontFamily:fonts.body,fontSize:16,color:colors.ink},
 card:{backgroundColor:colors.white,borderRadius:radius.lg,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,...shadow},
 sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.md},
 separator:{height:StyleSheet.hairlineWidth,backgroundColor:colors.line,marginLeft:space.lg},
 row:{minHeight:58,flexDirection:'row',alignItems:'center',gap:space.md,paddingHorizontal:space.lg,paddingVertical:space.md},
 rowIcon:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center'},
 chip:{minHeight:38,paddingHorizontal:14,borderRadius:radius.full,borderWidth:1,borderColor:colors.line,backgroundColor:colors.white,flexDirection:'row',alignItems:'center',gap:6},
 chipOn:{backgroundColor:colors.ink,borderColor:colors.ink},
 chipText:{fontFamily:fonts.bodyBold,fontSize:14,color:colors.text},
 segment:{flexDirection:'row',backgroundColor:colors.raised,borderRadius:radius.md,padding:3,gap:3},
 segmentItem:{flex:1,minHeight:40,borderRadius:10,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6,paddingHorizontal:8},
 segmentOn:{backgroundColor:colors.white,...shadow,shadowOpacity:0.1},
 segmentText:{fontFamily:fonts.bodyBold,fontSize:14,color:colors.muted},
 option:{flexDirection:'row',alignItems:'center',gap:space.md,minHeight:58,paddingHorizontal:space.lg,paddingVertical:space.md,borderRadius:radius.md,borderWidth:1,borderColor:colors.line,backgroundColor:colors.white},
 optionOn:{borderColor:colors.trust,borderWidth:1.5,backgroundColor:colors.trustSoft},
 stepper:{flexDirection:'row',alignItems:'center',gap:space.sm,minHeight:58,paddingHorizontal:space.lg,borderRadius:radius.md,borderWidth:1,borderColor:colors.line,backgroundColor:colors.white},
 stepBtn:{width:40,height:40,borderRadius:20,backgroundColor:colors.trustSoft,alignItems:'center',justifyContent:'center'},
 track:{height:6,borderRadius:3,backgroundColor:colors.line,overflow:'hidden'},
 trackFill:{height:6,borderRadius:3,backgroundColor:colors.trust},
 pill:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingVertical:4,paddingHorizontal:10,borderRadius:radius.full,maxWidth:'100%'},
 pillDot:{width:6,height:6,borderRadius:3},
 pillText:{fontFamily:fonts.bodyBold,fontSize:12.5,flexShrink:1},
 presence:{position:'absolute',right:0,bottom:0,borderWidth:2,borderColor:colors.white},
 banner:{flexDirection:'row',alignItems:'center',gap:10,padding:14,borderRadius:radius.md},
 empty:{alignItems:'center',gap:space.md,paddingVertical:space.xxxl,paddingHorizontal:space.xl},
 emptyIcon:{width:64,height:64,borderRadius:32,backgroundColor:colors.trustSoft,alignItems:'center',justifyContent:'center'},
 backdrop:{flex:1,backgroundColor:'rgba(11,12,12,0.4)'},
 sheet:{backgroundColor:colors.canvas,borderTopLeftRadius:radius.xl,borderTopRightRadius:radius.xl,paddingHorizontal:space.lg,paddingTop:space.sm,gap:space.lg},
 grabber:{alignSelf:'center',width:40,height:5,borderRadius:3,backgroundColor:colors.line},
 fact:{flexGrow:1,flexBasis:'45%',minWidth:140,gap:4,padding:14,borderRadius:radius.md,backgroundColor:colors.white,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line}
});
