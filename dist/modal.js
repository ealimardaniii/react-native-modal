// import * as React from 'react';
// import {
//   Animated,
//   BackHandler,
//   DeviceEventEmitter,
//   Dimensions,
//   EmitterSubscription,
//   InteractionManager,
//   KeyboardAvoidingView,
//   Modal,
//   NativeEventSubscription,
//   PanResponder,
//   PanResponderGestureState,
//   PanResponderInstance,
//   Platform,
//   StyleProp,
//   TouchableWithoutFeedback,
//   View,
//   ViewProps,
//   ViewStyle,
// } from 'react-native';
// import * as animatable from 'react-native-animatable';
// import {Animation, CustomAnimation} from 'react-native-animatable';
// import {
//   buildAnimations,
//   initializeAnimations,
//   reversePercentage,
// } from './utils';
// import styles from './modal.style';
// import {
//   AnimationEvent,
//   Direction,
//   GestureResponderEvent,
//   OnOrientationChange,
//   Orientation,
//   OrNull,
//   PresentationStyle,
// } from './types';
// // Override default react-native-animatable animations
// initializeAnimations();
// export type OnSwipeCompleteParams = {
//   swipingDirection: Direction;
// };
// type State = {
//   showContent: boolean;
//   isVisible: boolean;
//   deviceWidth: number;
//   deviceHeight: number;
//   isSwipeable: boolean;
//   pan: OrNull<Animated.ValueXY>;
// };
// const defaultProps = {
//   animationIn: 'slideInUp' as Animation | CustomAnimation,
//   animationInTiming: 300,
//   animationOut: 'slideOutDown' as Animation | CustomAnimation,
//   animationOutTiming: 300,
//   avoidKeyboard: false,
//   coverScreen: true,
//   hasBackdrop: true,
//   backdropColor: 'black',
//   backdropOpacity: 0.7,
//   backdropTransitionInTiming: 300,
//   backdropTransitionOutTiming: 300,
//   customBackdrop: null as React.ReactNode,
//   useNativeDriver: false,
//   deviceHeight: null as OrNull<number>,
//   deviceWidth: null as OrNull<number>,
//   hideModalContentWhileAnimating: false,
//   propagateSwipe: false as
//     | boolean
//     | ((
//         event: GestureResponderEvent,
//         gestureState: PanResponderGestureState,
//       ) => boolean),
//   isVisible: false,
//   panResponderThreshold: 4,
//   swipeThreshold: 100,
//   onModalShow: (() => null) as () => void,
//   onModalWillShow: (() => null) as () => void,
//   onModalHide: (() => null) as () => void,
//   onModalWillHide: (() => null) as () => void,
//   onBackdropPress: (() => null) as () => void,
//   onBackButtonPress: (() => null) as () => void,
//   scrollTo: null as OrNull<(e: any) => void>,
//   scrollOffset: 0,
//   scrollOffsetMax: 0,
//   scrollHorizontal: false,
//   statusBarTranslucent: false,
//   supportedOrientations: ['portrait', 'landscape'] as Orientation[],
// };
// export type ModalProps = ViewProps & {
//   children: React.ReactNode;
//   onSwipeStart?: (gestureState: PanResponderGestureState) => void;
//   onSwipeMove?: (
//     percentageShown: number,
//     gestureState: PanResponderGestureState,
//   ) => void;
//   onSwipeComplete?: (
//     params: OnSwipeCompleteParams,
//     gestureState: PanResponderGestureState,
//   ) => void;
//   onSwipeCancel?: (gestureState: PanResponderGestureState) => void;
//   style?: StyleProp<ViewStyle>;
//   swipeDirection?: Direction | Array<Direction>;
//   onDismiss?: () => void;
//   onShow?: () => void;
//   hardwareAccelerated?: boolean;
//   onOrientationChange?: OnOrientationChange;
//   presentationStyle?: PresentationStyle;
//   // Default ModalProps Provided
//   useNativeDriverForBackdrop?: boolean;
// } & typeof defaultProps;
// const extractAnimationFromProps = (props: ModalProps) => ({
//   animationIn: props.animationIn,
//   animationOut: props.animationOut,
// });
// export class ReactNativeModal extends React.Component<ModalProps, State> {
//   public static defaultProps = defaultProps;
//   private backHandler: NativeEventSubscription | null = null;
//   // We use an internal state for keeping track of the modal visibility: this allows us to keep
//   // the modal visible during the exit animation, even if the user has already change the
//   // isVisible prop to false.
//   // We store in the state the device width and height so that we can update the modal on
//   // device rotation.
//   state: State = {
//     showContent: true,
//     isVisible: false,
//     deviceWidth: Dimensions.get('window').width,
//     deviceHeight: Dimensions.get('window').height,
//     isSwipeable: !!this.props.swipeDirection,
//     pan: null,
//   };
//   isTransitioning = false;
//   inSwipeClosingState = false;
//   currentSwipingDirection: OrNull<Direction> = null;
//   animationIn: string;
//   animationOut: string;
//   backdropRef: any;
//   contentRef: any;
//   panResponder: OrNull<PanResponderInstance> = null;
//   didUpdateDimensionsEmitter: OrNull<EmitterSubscription> = null;
//   interactionHandle: OrNull<number> = null;
//   constructor(props: ModalProps) {
//     super(props);
//     const {animationIn, animationOut} = buildAnimations(
//       extractAnimationFromProps(props),
//     );
//     this.animationIn = animationIn;
//     this.animationOut = animationOut;
//     if (this.state.isSwipeable) {
//       this.state = {
//         ...this.state,
//         pan: new Animated.ValueXY(),
//       };
//       this.buildPanResponder();
//     }
//     if (props.isVisible) {
//       this.state = {
//         ...this.state,
//         isVisible: true,
//         showContent: true,
//       };
//     }
//   }
//   static getDerivedStateFromProps(
//     nextProps: Readonly<ModalProps>,
//     state: State,
//   ) {
//     if (!state.isVisible && nextProps.isVisible) {
//       return {isVisible: true, showContent: true};
//     }
//     return null;
//   }
//   componentDidMount() {
//     // Show deprecation message
//     if ((this.props as any).onSwipe) {
//       console.warn(
//         '`<Modal onSwipe="..." />` is deprecated and will be removed starting from 13.0.0. Use `<Modal onSwipeComplete="..." />` instead.',
//       );
//     }
//     this.didUpdateDimensionsEmitter = DeviceEventEmitter.addListener(
//       'didUpdateDimensions',
//       this.handleDimensionsUpdate,
//     );
//     if (this.state.isVisible) {
//       this.open();
//     }
//     this.backHandler = BackHandler.addEventListener(
//       'hardwareBackPress',
//       this.onBackButtonPress,
//     );
//   }
//   componentWillUnmount() {
//     if (this.backHandler) {
//       this.backHandler.remove();
//       this.backHandler = null;
//     }
//     if (this.didUpdateDimensionsEmitter) {
//       this.didUpdateDimensionsEmitter.remove();
//     }
//     if (this.interactionHandle) {
//       InteractionManager.clearInteractionHandle(this.interactionHandle);
//       this.interactionHandle = null;
//     }
//   }
//   componentDidUpdate(prevProps: ModalProps) {
//     // If the animations have been changed then rebuild them to make sure we're
//     // using the most up-to-date ones
//     if (
//       this.props.animationIn !== prevProps.animationIn ||
//       this.props.animationOut !== prevProps.animationOut
//     ) {
//       const {animationIn, animationOut} = buildAnimations(
//         extractAnimationFromProps(this.props),
//       );
//       this.animationIn = animationIn;
//       this.animationOut = animationOut;
//     }
//     // If backdrop opacity has been changed then make sure to update it
//     if (
//       this.props.backdropOpacity !== prevProps.backdropOpacity &&
//       this.backdropRef
//     ) {
//       this.backdropRef.transitionTo(
//         {opacity: this.props.backdropOpacity},
//         this.props.backdropTransitionInTiming,
//       );
//     }
//     // On modal open request, we slide the view up and fade in the backdrop
//     if (this.props.isVisible && !prevProps.isVisible) {
//       this.open();
//     } else if (!this.props.isVisible && prevProps.isVisible) {
//       // On modal close request, we slide the view down and fade out the backdrop
//       this.close();
//     }
//   }
//   getDeviceHeight = () => this.props.deviceHeight || this.state.deviceHeight;
//   getDeviceWidth = () => this.props.deviceWidth || this.state.deviceWidth;
//   onBackButtonPress = () => {
//     if (this.props.onBackButtonPress && this.props.isVisible) {
//       this.props.onBackButtonPress();
//       return true;
//     }
//     return false;
//   };
//   shouldPropagateSwipe = (
//     evt: GestureResponderEvent,
//     gestureState: PanResponderGestureState,
//   ) => {
//     return typeof this.props.propagateSwipe === 'function'
//       ? this.props.propagateSwipe(evt, gestureState)
//       : this.props.propagateSwipe;
//   };
//   buildPanResponder = () => {
//     let animEvt: OrNull<AnimationEvent> = null;
//     this.panResponder = PanResponder.create({
//       onMoveShouldSetPanResponder: (evt, gestureState) => {
//         // Use propagateSwipe to allow inner content to scroll. See PR:
//         // https://github.com/react-native-community/react-native-modal/pull/246
//         if (!this.shouldPropagateSwipe(evt, gestureState)) {
//           // The number "4" is just a good tradeoff to make the panResponder
//           // work correctly even when the modal has touchable buttons.
//           // However, if you want to overwrite this and choose for yourself,
//           // set panResponderThreshold in the props.
//           // For reference:
//           // https://github.com/react-native-community/react-native-modal/pull/197
//           const shouldSetPanResponder =
//             Math.abs(gestureState.dx) >= this.props.panResponderThreshold ||
//             Math.abs(gestureState.dy) >= this.props.panResponderThreshold;
//           if (shouldSetPanResponder && this.props.onSwipeStart) {
//             this.props.onSwipeStart(gestureState);
//           }
//           this.currentSwipingDirection = this.getSwipingDirection(gestureState);
//           animEvt = this.createAnimationEventForSwipe();
//           return shouldSetPanResponder;
//         }
//         return false;
//       },
//       onStartShouldSetPanResponder: (e: any, gestureState) => {
//         const hasScrollableView =
//           e._dispatchInstances &&
//           e._dispatchInstances.some((instance: any) =>
//             /scrollview|flatlist/i.test(instance.type),
//           );
//         if (
//           hasScrollableView &&
//           this.shouldPropagateSwipe(e, gestureState) &&
//           this.props.scrollTo &&
//           this.props.scrollOffset > 0
//         ) {
//           return false; // user needs to be able to scroll content back up
//         }
//         if (this.props.onSwipeStart) {
//           this.props.onSwipeStart(gestureState);
//         }
//         // Cleared so that onPanResponderMove can wait to have some delta
//         // to work with
//         this.currentSwipingDirection = null;
//         return true;
//       },
//       onPanResponderMove: (evt, gestureState) => {
//         // Using onStartShouldSetPanResponder we don't have any delta so we don't know
//         // The direction to which the user is swiping until some move have been done
//         if (!this.currentSwipingDirection) {
//           if (gestureState.dx === 0 && gestureState.dy === 0) {
//             return;
//           }
//           this.currentSwipingDirection = this.getSwipingDirection(gestureState);
//           animEvt = this.createAnimationEventForSwipe();
//         }
//         if (this.isSwipeDirectionAllowed(gestureState)) {
//           // Dim the background while swiping the modal
//           const newOpacityFactor =
//             1 - this.calcDistancePercentage(gestureState);
//           this.backdropRef &&
//             this.backdropRef.transitionTo({
//               opacity: this.props.backdropOpacity * newOpacityFactor,
//             });
//           animEvt!(evt, gestureState);
//           if (this.props.onSwipeMove) {
//             this.props.onSwipeMove(newOpacityFactor, gestureState);
//           }
//         } else {
//           if (this.props.scrollTo) {
//             if (this.props.scrollHorizontal) {
//               let offsetX = -gestureState.dx;
//               if (offsetX > this.props.scrollOffsetMax) {
//                 offsetX -= (offsetX - this.props.scrollOffsetMax) / 2;
//               }
//               this.props.scrollTo({x: offsetX, animated: false});
//             } else {
//               let offsetY = -gestureState.dy;
//               if (offsetY > this.props.scrollOffsetMax) {
//                 offsetY -= (offsetY - this.props.scrollOffsetMax) / 2;
//               }
//               this.props.scrollTo({y: offsetY, animated: false});
//             }
//           }
//         }
//       },
//       onPanResponderRelease: (evt, gestureState) => {
//         // Call the onSwipe prop if the threshold has been exceeded on the right direction
//         const accDistance = this.getAccDistancePerDirection(gestureState);
//         if (
//           accDistance > this.props.swipeThreshold &&
//           this.isSwipeDirectionAllowed(gestureState)
//         ) {
//           if (this.props.onSwipeComplete) {
//             this.inSwipeClosingState = true;
//             this.props.onSwipeComplete(
//               {
//                 swipingDirection: this.getSwipingDirection(gestureState),
//               },
//               gestureState,
//             );
//             return;
//           }
//           // Deprecated. Remove later.
//           if ((this.props as any).onSwipe) {
//             this.inSwipeClosingState = true;
//             (this.props as any).onSwipe();
//             return;
//           }
//         }
//         //Reset backdrop opacity and modal position
//         if (this.props.onSwipeCancel) {
//           this.props.onSwipeCancel(gestureState);
//         }
//         if (this.backdropRef) {
//           this.backdropRef.transitionTo({
//             opacity: this.props.backdropOpacity,
//           });
//         }
//         Animated.spring(this.state.pan!, {
//           toValue: {x: 0, y: 0},
//           bounciness: 0,
//           useNativeDriver: false,
//         }).start();
//         if (this.props.scrollTo) {
//           if (this.props.scrollOffset > this.props.scrollOffsetMax) {
//             this.props.scrollTo({
//               y: this.props.scrollOffsetMax,
//               animated: true,
//             });
//           }
//         }
//       },
//     });
//   };
//   getAccDistancePerDirection = (gestureState: PanResponderGestureState) => {
//     switch (this.currentSwipingDirection) {
//       case 'up':
//         return -gestureState.dy;
//       case 'down':
//         return gestureState.dy;
//       case 'right':
//         return gestureState.dx;
//       case 'left':
//         return -gestureState.dx;
//       default:
//         return 0;
//     }
//   };
//   getSwipingDirection = (gestureState: PanResponderGestureState) => {
//     if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
//       return gestureState.dx > 0 ? 'right' : 'left';
//     }
//     return gestureState.dy > 0 ? 'down' : 'up';
//   };
//   calcDistancePercentage = (gestureState: PanResponderGestureState) => {
//     switch (this.currentSwipingDirection) {
//       case 'down':
//         return (
//           (gestureState.moveY - gestureState.y0) /
//           ((this.props.deviceHeight || this.state.deviceHeight) -
//             gestureState.y0)
//         );
//       case 'up':
//         return reversePercentage(gestureState.moveY / gestureState.y0);
//       case 'left':
//         return reversePercentage(gestureState.moveX / gestureState.x0);
//       case 'right':
//         return (
//           (gestureState.moveX - gestureState.x0) /
//           ((this.props.deviceWidth || this.state.deviceWidth) - gestureState.x0)
//         );
//       default:
//         return 0;
//     }
//   };
//   createAnimationEventForSwipe = () => {
//     if (
//       this.currentSwipingDirection === 'right' ||
//       this.currentSwipingDirection === 'left'
//     ) {
//       return Animated.event([null, {dx: this.state.pan!.x}], {
//         useNativeDriver: false,
//       });
//     } else {
//       return Animated.event([null, {dy: this.state.pan!.y}], {
//         useNativeDriver: false,
//       });
//     }
//   };
//   isDirectionIncluded = (direction: Direction) => {
//     return Array.isArray(this.props.swipeDirection)
//       ? this.props.swipeDirection.includes(direction)
//       : this.props.swipeDirection === direction;
//   };
//   isSwipeDirectionAllowed = ({dy, dx}: PanResponderGestureState) => {
//     const draggedDown = dy > 0;
//     const draggedUp = dy < 0;
//     const draggedLeft = dx < 0;
//     const draggedRight = dx > 0;
//     if (
//       this.currentSwipingDirection === 'up' &&
//       this.isDirectionIncluded('up') &&
//       draggedUp
//     ) {
//       return true;
//     } else if (
//       this.currentSwipingDirection === 'down' &&
//       this.isDirectionIncluded('down') &&
//       draggedDown
//     ) {
//       return true;
//     } else if (
//       this.currentSwipingDirection === 'right' &&
//       this.isDirectionIncluded('right') &&
//       draggedRight
//     ) {
//       return true;
//     } else if (
//       this.currentSwipingDirection === 'left' &&
//       this.isDirectionIncluded('left') &&
//       draggedLeft
//     ) {
//       return true;
//     }
//     return false;
//   };
//   handleDimensionsUpdate = () => {
//     if (!this.props.deviceHeight && !this.props.deviceWidth) {
//       // Here we update the device dimensions in the state if the layout changed
//       // (triggering a render)
//       const deviceWidth = Dimensions.get('window').width;
//       const deviceHeight = Dimensions.get('window').height;
//       if (
//         deviceWidth !== this.state.deviceWidth ||
//         deviceHeight !== this.state.deviceHeight
//       ) {
//         this.setState({deviceWidth, deviceHeight});
//       }
//     }
//   };
//   open = () => {
//     if (this.isTransitioning) {
//       return;
//     }
//     this.isTransitioning = true;
//     if (this.backdropRef) {
//       this.backdropRef.transitionTo(
//         {opacity: this.props.backdropOpacity},
//         this.props.backdropTransitionInTiming,
//       );
//     }
//     // This is for resetting the pan position,otherwise the modal gets stuck
//     // at the last released position when you try to open it.
//     // TODO: Could certainly be improved - no idea for the moment.
//     if (this.state.isSwipeable) {
//       this.state.pan!.setValue({x: 0, y: 0});
//     }
//     if (this.contentRef) {
//       this.props.onModalWillShow && this.props.onModalWillShow();
//       if (this.interactionHandle == null) {
//         this.interactionHandle = InteractionManager.createInteractionHandle();
//       }
//       this.contentRef
//         .animate(this.animationIn, this.props.animationInTiming)
//         .then(() => {
//           this.isTransitioning = false;
//           if (this.interactionHandle) {
//             InteractionManager.clearInteractionHandle(this.interactionHandle);
//             this.interactionHandle = null;
//           }
//           if (!this.props.isVisible) {
//             this.close();
//           } else {
//             this.props.onModalShow();
//           }
//         });
//     }
//   };
//   close = () => {
//     if (this.isTransitioning) {
//       return;
//     }
//     this.isTransitioning = true;
//     if (this.backdropRef) {
//       this.backdropRef.transitionTo(
//         {opacity: 0},
//         this.props.backdropTransitionOutTiming,
//       );
//     }
//     let animationOut = this.animationOut;
//     if (this.inSwipeClosingState) {
//       this.inSwipeClosingState = false;
//       if (this.currentSwipingDirection === 'up') {
//         animationOut = 'slideOutUp';
//       } else if (this.currentSwipingDirection === 'down') {
//         animationOut = 'slideOutDown';
//       } else if (this.currentSwipingDirection === 'right') {
//         animationOut = 'slideOutRight';
//       } else if (this.currentSwipingDirection === 'left') {
//         animationOut = 'slideOutLeft';
//       }
//     }
//     if (this.contentRef) {
//       this.props.onModalWillHide && this.props.onModalWillHide();
//       if (this.interactionHandle == null) {
//         this.interactionHandle = InteractionManager.createInteractionHandle();
//       }
//       this.contentRef
//         .animate(animationOut, this.props.animationOutTiming)
//         .then(() => {
//           this.isTransitioning = false;
//           if (this.interactionHandle) {
//             InteractionManager.clearInteractionHandle(this.interactionHandle);
//             this.interactionHandle = null;
//           }
//           if (this.props.isVisible) {
//             this.open();
//           } else {
//             this.setState(
//               {
//                 showContent: false,
//               },
//               () => {
//                 this.setState(
//                   {
//                     isVisible: false,
//                   },
//                   () => {
//                     this.props.onModalHide();
//                   },
//                 );
//               },
//             );
//           }
//         });
//     }
//   };
//   makeBackdrop = () => {
//     if (!this.props.hasBackdrop) {
//       return null;
//     }
//     if (
//       this.props.customBackdrop &&
//       !React.isValidElement(this.props.customBackdrop)
//     ) {
//       console.warn(
//         'Invalid customBackdrop element passed to Modal. You must provide a valid React element.',
//       );
//     }
//     const {
//       customBackdrop,
//       backdropColor,
//       useNativeDriver,
//       useNativeDriverForBackdrop,
//       onBackdropPress,
//     } = this.props;
//     const hasCustomBackdrop = !!this.props.customBackdrop;
//     const backdropComputedStyle = [
//       {
//         width: this.getDeviceWidth(),
//         height: this.getDeviceHeight(),
//         backgroundColor:
//           this.state.showContent && !hasCustomBackdrop
//             ? backdropColor
//             : 'transparent',
//       },
//     ];
//     const backdropWrapper = (
//       <animatable.View
//         // @ts-expect-error TODO fix it
//         ref={ref => (this.backdropRef = ref)}
//         useNativeDriver={
//           useNativeDriverForBackdrop !== undefined
//             ? useNativeDriverForBackdrop
//             : useNativeDriver
//         }
//         style={[styles.backdrop, backdropComputedStyle]}>
//         {hasCustomBackdrop && customBackdrop}
//       </animatable.View>
//     );
//     if (hasCustomBackdrop) {
//       // The user will handle backdrop presses himself
//       return backdropWrapper;
//     }
//     // If there's no custom backdrop, handle presses with
//     // TouchableWithoutFeedback
//     return (
//       <TouchableWithoutFeedback onPress={onBackdropPress}>
//         {backdropWrapper}
//       </TouchableWithoutFeedback>
//     );
//   };
//   render() {
//     /* eslint-disable @typescript-eslint/no-unused-vars */
//     const {
//       animationIn,
//       animationInTiming,
//       animationOut,
//       animationOutTiming,
//       avoidKeyboard,
//       coverScreen,
//       hasBackdrop,
//       backdropColor,
//       backdropOpacity,
//       backdropTransitionInTiming,
//       backdropTransitionOutTiming,
//       customBackdrop,
//       children,
//       isVisible,
//       onModalShow,
//       onBackButtonPress,
//       useNativeDriver,
//       propagateSwipe,
//       style,
//       ...otherProps
//     } = this.props;
//     const {testID, ...containerProps} = otherProps;
//     const computedStyle = [
//       {margin: this.getDeviceWidth() * 0.05, transform: [{translateY: 0}]},
//       styles.content,
//       style,
//     ];
//     let panHandlers = {};
//     let panPosition = {};
//     if (this.state.isSwipeable) {
//       panHandlers = {...this.panResponder!.panHandlers};
//       if (useNativeDriver) {
//         panPosition = {
//           transform: this.state.pan!.getTranslateTransform(),
//         };
//       } else {
//         panPosition = this.state.pan!.getLayout();
//       }
//     }
//     // The user might decide not to show the modal while it is animating
//     // to enhance performance.
//     const _children =
//       this.props.hideModalContentWhileAnimating &&
//       this.props.useNativeDriver &&
//       !this.state.showContent ? (
//         <animatable.View />
//       ) : (
//         children
//       );
//     const containerView = (
//       <animatable.View
//         {...panHandlers}
//         // @ts-expect-error TODO fix it
//         ref={ref => (this.contentRef = ref)}
//         style={[panPosition, computedStyle]}
//         pointerEvents="box-none"
//         useNativeDriver={useNativeDriver}
//         {...containerProps}>
//         {_children}
//       </animatable.View>
//     );
//     // If coverScreen is set to false by the user
//     // we render the modal inside the parent view directly
//     if (!coverScreen && this.state.isVisible) {
//       return (
//         <View
//           pointerEvents="box-none"
//           style={[styles.backdrop, styles.containerBox]}>
//           {this.makeBackdrop()}
//           {containerView}
//         </View>
//       );
//     }
//     return (
//       <Modal
//         transparent={true}
//         animationType={'none'}
//         visible={this.state.isVisible}
//         onRequestClose={onBackButtonPress}
//         {...otherProps}>
//         {this.makeBackdrop()}
//         {avoidKeyboard ? (
//           <KeyboardAvoidingView
//             behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//             pointerEvents="box-none"
//             style={computedStyle.concat([{margin: 0}])}>
//             {containerView}
//           </KeyboardAvoidingView>
//         ) : (
//           containerView
//         )}
//       </Modal>
//     );
//   }
// }
// export default ReactNativeModal;
import * as React from 'react';
import {
  BackHandler,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  buildAnimations,
  initializeAnimations,
  reversePercentage,
} from './utils';
import styles from './modal.style';
import * as animatable from 'react-native-animatable';
initializeAnimations();
const defaultProps = {
  animationIn: 'slideInUp',
  animationInTiming: 300,
  animationOut: 'slideOutDown',
  animationOutTiming: 300,
  avoidKeyboard: false,
  coverScreen: true,
  hasBackdrop: true,
  backdropColor: 'black',
  backdropOpacity: 0.7,
  backdropTransitionInTiming: 300,
  backdropTransitionOutTiming: 300,
  customBackdrop: null,
  useNativeDriver: false,
  deviceHeight: null,
  deviceWidth: null,
  hideModalContentWhileAnimating: false,
  propagateSwipe: false,
  isVisible: false,
  panResponderThreshold: 4,
  swipeThreshold: 100,
  onModalShow: () => null,
  onModalWillShow: () => null,
  onModalHide: () => null,
  onModalWillHide: () => null,
  onBackdropPress: () => null,
  onBackButtonPress: () => null,
  scrollTo: null,
  scrollOffset: 0,
  scrollOffsetMax: 0,
  scrollHorizontal: false,
  statusBarTranslucent: false,
  supportedOrientations: ['portrait', 'landscape'],
};
const extractAnimationFromProps = props => ({
  animationIn: props.animationIn,
  animationOut: props.animationOut,
});
export class ReactNativeModal extends React.Component {
  static defaultProps = defaultProps;
  backdropAnimatedOpacity = new Animated.Value(0);
  backHandler = null;
  isTransitioning = false;
  inSwipeClosingState = false;
  // currentSwipingDirection: SwipeDirection | null = null;
  currentSwipingDirection = null;
  animationIn;
  animationOut;
  contentRef;
  panResponder = null;
  didUpdateDimensionsEmitter = null;
  interactionHandle = null;
  constructor(props) {
    super(props);
    const {animationIn, animationOut} = buildAnimations(
      extractAnimationFromProps(props),
    );
    this.animationIn = animationIn;
    this.animationOut = animationOut;
    this.state = {
      showContent: false,
      isVisible: false,
      deviceWidth: Dimensions.get('window').width,
      deviceHeight: Dimensions.get('window').height,
      isSwipeable: !!props.swipeDirection,
      pan: null,
    };
    if (this.state.isSwipeable) {
      this.state = {
        ...this.state,
        pan: new Animated.ValueXY(),
      };
      this.buildPanResponder();
    }
    if (props.isVisible) {
      this.state = {
        ...this.state,
        isVisible: true,
        showContent: true,
      };
    }
    const initial = props.isVisible ? props.backdropOpacity : 0;
    this.backdropAnimatedOpacity = new Animated.Value(initial);
  }
  static getDerivedStateFromProps(nextProps, state) {
    if (!state.isVisible && nextProps.isVisible) {
      return {isVisible: true, showContent: true};
    }
    return null;
  }
  componentDidMount() {
    if (this.props.onSwipe) {
      console.warn(
        '`<Modal onSwipe="..." />` is deprecated and will be removed starting from 13.0.0. Use `<Modal onSwipeComplete="..." />` instead.',
      );
    }
    this.didUpdateDimensionsEmitter = DeviceEventEmitter.addListener(
      'didUpdateDimensions',
      this.handleDimensionsUpdate,
    );
    if (this.state.isVisible) {
      this.open();
    }
    this.backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      this.onBackButtonPress,
    );
  }
  componentWillUnmount() {
    if (this.backHandler) {
      this.backHandler.remove();
      this.backHandler = null;
    }
    if (this.didUpdateDimensionsEmitter) {
      this.didUpdateDimensionsEmitter.remove();
      this.didUpdateDimensionsEmitter = null;
    }
    if (this.interactionHandle) {
      InteractionManager.clearInteractionHandle(this.interactionHandle);
      this.interactionHandle = null;
    }
  }
  componentDidUpdate(prevProps) {
    if (
      this.props.animationIn !== prevProps.animationIn ||
      this.props.animationOut !== prevProps.animationOut
    ) {
      const {animationIn, animationOut} = buildAnimations(
        extractAnimationFromProps(this.props),
      );
      this.animationIn = animationIn;
      this.animationOut = animationOut;
    }
    if (this.props.isVisible && !prevProps.isVisible) {
      this.open();
    } else if (!this.props.isVisible && prevProps.isVisible) {
      this.close();
    }
  }
  getDeviceHeight = () => this.props.deviceHeight || this.state.deviceHeight;
  getDeviceWidth = () => this.props.deviceWidth || this.state.deviceWidth;
  onBackButtonPress = () => {
    if (this.props.onBackButtonPress && this.props.isVisible) {
      this.props.onBackButtonPress();
      return true;
    }
    return false;
  };
  shouldPropagateSwipe = (evt, gestureState) => {
    return typeof this.props.propagateSwipe === 'function'
      ? this.props.propagateSwipe(evt, gestureState)
      : this.props.propagateSwipe;
  };
  buildPanResponder = () => {
    let animEvt = null;
    this.panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (!this.shouldPropagateSwipe(evt, gestureState)) {
          const shouldSetPanResponder =
            Math.abs(gestureState.dx) >=
              (this.props.panResponderThreshold ?? 4) ||
            Math.abs(gestureState.dy) >=
              (this.props.panResponderThreshold ?? 4);
          if (shouldSetPanResponder && this.props.onSwipeStart) {
            this.props.onSwipeStart(gestureState);
          }
          this.currentSwipingDirection = this.getSwipingDirection(gestureState);
          animEvt = this.createAnimationEventForSwipe();
          return shouldSetPanResponder;
        }
        return false;
      },
      onStartShouldSetPanResponder: (e, gestureState) => {
        const hasScrollableView =
          e?._dispatchInstances &&
          e._dispatchInstances.some(instance =>
            /scrollview|flatlist/i.test(instance.type),
          );
        if (
          hasScrollableView &&
          this.shouldPropagateSwipe(e, gestureState) &&
          this.props.scrollTo &&
          (this.props.scrollOffset ?? 0) > 0
        ) {
          return false;
        }
        if (this.props.onSwipeStart) {
          this.props.onSwipeStart(gestureState);
        }
        this.currentSwipingDirection = null;
        return true;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!this.currentSwipingDirection) {
          if (gestureState.dx === 0 && gestureState.dy === 0) return;
          this.currentSwipingDirection = this.getSwipingDirection(gestureState);
          animEvt = this.createAnimationEventForSwipe();
        }
        if (this.isSwipeDirectionAllowed(gestureState)) {
          const newOpacityFactor =
            1 - this.calcDistancePercentage(gestureState);
          animEvt?.(evt, gestureState);
          if (this.props.onSwipeMove) {
            this.props.onSwipeMove(newOpacityFactor, gestureState);
          }
        } else {
          if (this.props.scrollTo) {
            if (this.props.scrollHorizontal) {
              let offsetX = -gestureState.dx;
              if (offsetX > (this.props.scrollOffsetMax ?? 0)) {
                offsetX -= (offsetX - (this.props.scrollOffsetMax ?? 0)) / 2;
              }
              this.props.scrollTo({x: offsetX, animated: false});
            } else {
              let offsetY = -gestureState.dy;
              if (offsetY > (this.props.scrollOffsetMax ?? 0)) {
                offsetY -= (offsetY - (this.props.scrollOffsetMax ?? 0)) / 2;
              }
              this.props.scrollTo({y: offsetY, animated: false});
            }
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const accDistance = this.getAccDistancePerDirection(gestureState);
        if (
          accDistance > (this.props.swipeThreshold ?? 100) &&
          this.isSwipeDirectionAllowed(gestureState)
        ) {
          if (this.props.onSwipeComplete) {
            this.inSwipeClosingState = true;
            this.props.onSwipeComplete(
              {
                swipingDirection: this.getSwipingDirection(gestureState),
              },
              gestureState,
            );
            return;
          }
          // Deprecated
          if (this.props.onSwipe) {
            this.inSwipeClosingState = true;
            this.props.onSwipe();
            return;
          }
        }
        if (this.props.onSwipeCancel) {
          this.props.onSwipeCancel(gestureState);
        }
        if (this.state.pan) {
          Animated.spring(this.state.pan, {
            toValue: {x: 0, y: 0},
            bounciness: 0,
            useNativeDriver: false,
          }).start();
        }
        if (this.props.scrollTo) {
          if (
            (this.props.scrollOffset ?? 0) > (this.props.scrollOffsetMax ?? 0)
          ) {
            this.props.scrollTo({
              y: this.props.scrollOffsetMax ?? 0,
              animated: true,
            });
          }
        }
      },
    });
  };
  getAccDistancePerDirection = gestureState => {
    switch (this.currentSwipingDirection) {
      case 'up':
        return -gestureState.dy;
      case 'down':
        return gestureState.dy;
      case 'right':
        return gestureState.dx;
      case 'left':
        return -gestureState.dx;
      default:
        return 0;
    }
  };
  getSwipingDirection = gestureState => {
    if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
      return gestureState.dx > 0 ? 'right' : 'left';
    }
    return gestureState.dy > 0 ? 'down' : 'up';
  };
  calcDistancePercentage = gestureState => {
    const deviceHeight = this.props.deviceHeight || this.state.deviceHeight;
    const deviceWidth = this.props.deviceWidth || this.state.deviceWidth;
    switch (this.currentSwipingDirection) {
      case 'down':
        return (
          (gestureState.moveY - gestureState.y0) /
          (deviceHeight - gestureState.y0)
        );
      case 'up':
        return reversePercentage(gestureState.moveY / gestureState.y0);
      case 'left':
        return reversePercentage(gestureState.moveX / gestureState.x0);
      case 'right':
        return (
          (gestureState.moveX - gestureState.x0) /
          (deviceWidth - gestureState.x0)
        );
      default:
        return 0;
    }
  };
  createAnimationEventForSwipe = () => {
    if (!this.state.pan) return null;
    if (
      this.currentSwipingDirection === 'right' ||
      this.currentSwipingDirection === 'left'
    ) {
      return Animated.event([null, {dx: this.state.pan.x}], {
        useNativeDriver: false,
      });
    }
    return Animated.event([null, {dy: this.state.pan.y}], {
      useNativeDriver: false,
    });
  };
  isDirectionIncluded = direction => {
    return Array.isArray(this.props.swipeDirection)
      ? this.props.swipeDirection.includes(direction)
      : this.props.swipeDirection === direction;
  };
  isSwipeDirectionAllowed = ({dy, dx}) => {
    const draggedDown = dy > 0;
    const draggedUp = dy < 0;
    const draggedLeft = dx < 0;
    const draggedRight = dx > 0;
    if (
      this.currentSwipingDirection === 'up' &&
      this.isDirectionIncluded('up') &&
      draggedUp
    )
      return true;
    if (
      this.currentSwipingDirection === 'down' &&
      this.isDirectionIncluded('down') &&
      draggedDown
    )
      return true;
    if (
      this.currentSwipingDirection === 'right' &&
      this.isDirectionIncluded('right') &&
      draggedRight
    )
      return true;
    if (
      this.currentSwipingDirection === 'left' &&
      this.isDirectionIncluded('left') &&
      draggedLeft
    )
      return true;
    return false;
  };
  handleDimensionsUpdate = () => {
    if (!this.props.deviceHeight && !this.props.deviceWidth) {
      const deviceWidth = Dimensions.get('window').width;
      const deviceHeight = Dimensions.get('window').height;
      if (
        deviceWidth !== this.state.deviceWidth ||
        deviceHeight !== this.state.deviceHeight
      ) {
        this.setState({deviceWidth, deviceHeight});
      }
    }
  };
  open = () => {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    Animated.timing(this.backdropAnimatedOpacity, {
      toValue: this.props.backdropOpacity ?? 0.7,
      duration: this.props.backdropTransitionInTiming ?? 300,
      useNativeDriver: true,
    }).start();
    if (this.contentRef) {
      this.props.onModalWillShow?.();
      if (this.interactionHandle == null) {
        this.interactionHandle = InteractionManager.createInteractionHandle();
      }
      this.contentRef
        .animate(this.animationIn, this.props.animationInTiming ?? 300)
        .then(() => {
          this.isTransitioning = false;
          if (this.interactionHandle) {
            InteractionManager.clearInteractionHandle(this.interactionHandle);
            this.interactionHandle = null;
          }
          if (!this.props.isVisible) {
            this.close();
          } else {
            this.props.onModalShow?.();
          }
        });
    }
  };
  close = () => {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    Animated.timing(this.backdropAnimatedOpacity, {
      toValue: 0,
      duration: this.props.backdropTransitionOutTiming ?? 300,
      useNativeDriver: true,
    }).start();
    let animationOut = this.animationOut;
    if (this.inSwipeClosingState) {
      this.inSwipeClosingState = false;
      if (this.currentSwipingDirection === 'up') animationOut = 'slideOutUp';
      else if (this.currentSwipingDirection === 'down')
        animationOut = 'slideOutDown';
      else if (this.currentSwipingDirection === 'right')
        animationOut = 'slideOutRight';
      else if (this.currentSwipingDirection === 'left')
        animationOut = 'slideOutLeft';
    }
    if (this.contentRef) {
      this.props.onModalWillHide?.();
      if (this.interactionHandle == null) {
        this.interactionHandle = InteractionManager.createInteractionHandle();
      }
      this.contentRef
        .animate(animationOut, this.props.animationOutTiming ?? 300)
        .then(() => {
          this.isTransitioning = false;
          if (this.interactionHandle) {
            InteractionManager.clearInteractionHandle(this.interactionHandle);
            this.interactionHandle = null;
          }
          if (this.props.isVisible) {
            this.open();
          } else {
            this.setState({showContent: false}, () => {
              this.setState({isVisible: false}, () => {
                this.props.onModalHide?.();
              });
            });
          }
        });
    }
    InteractionManager.runAfterInteractions(() => {
      if (this.state.isSwipeable && this.state.pan) {
        this.state.pan.setValue({x: 0, y: 0});
      }
    });
  };
  makeBackdrop = () => {
    if (!this.props.hasBackdrop) return null;
    const {customBackdrop, onBackdropPress} = this.props;
    const hasCustomBackdrop = !!customBackdrop;
    const backdropWrapper = React.createElement(
      Animated.View,
      {
        style: [
          styles.backdrop,
          {
            width: this.getDeviceWidth(),
            height: this.getDeviceHeight(),
            backgroundColor: !hasCustomBackdrop
              ? this.props.backdropColor
              : 'transparent',
            opacity: this.backdropAnimatedOpacity,
          },
        ],
      },
      hasCustomBackdrop && customBackdrop,
    );
    if (hasCustomBackdrop) return backdropWrapper;
    return React.createElement(
      TouchableWithoutFeedback,
      {onPress: onBackdropPress},
      backdropWrapper,
    );
  };
  render() {
    const {
      animationIn,
      animationInTiming,
      animationOut,
      animationOutTiming,
      avoidKeyboard,
      coverScreen,
      hasBackdrop,
      backdropColor,
      backdropOpacity,
      backdropTransitionInTiming,
      backdropTransitionOutTiming,
      customBackdrop,
      children,
      isVisible,
      onModalShow,
      onBackButtonPress,
      useNativeDriver,
      propagateSwipe,
      style,
      ...otherProps
    } = this.props;
    const computedStyle = [
      {margin: this.getDeviceWidth() * 0.05, transform: [{translateY: 0}]},
      styles.content,
      style,
    ];
    let panHandlers = {};
    let panPosition = {};
    if (this.state.isSwipeable && this.panResponder && this.state.pan) {
      panHandlers = {...this.panResponder.panHandlers};
      if (useNativeDriver) {
        panPosition = {transform: this.state.pan.getTranslateTransform()};
      } else {
        panPosition = this.state.pan.getLayout();
      }
    }
    const _children =
      this.props.hideModalContentWhileAnimating &&
      this.props.useNativeDriver &&
      !this.state.showContent
        ? React.createElement(animatable.View, null)
        : children;
    const containerView = React.createElement(
      animatable.View,
      {
        ...panHandlers,
        ref: ref => (this.contentRef = ref),
        style: [panPosition, computedStyle],
        pointerEvents: 'box-none',
        useNativeDriver: useNativeDriver,
        ...otherProps,
      },
      _children,
    );
    if (!coverScreen && this.state.isVisible) {
      return React.createElement(
        View,
        {
          pointerEvents: 'box-none',
          style: [styles.backdrop, styles.containerBox],
        },
        this.makeBackdrop(),
        containerView,
      );
    }
    return React.createElement(
      Modal,
      {
        transparent: true,
        animationType: 'none',
        visible: this.state.isVisible,
        onRequestClose: onBackButtonPress,
        ...otherProps,
      },
      this.makeBackdrop(),
      avoidKeyboard
        ? React.createElement(
            KeyboardAvoidingView,
            {
              behavior: Platform.OS === 'ios' ? 'padding' : undefined,
              pointerEvents: 'box-none',
              style: computedStyle.concat([{margin: 0}]),
            },
            containerView,
          )
        : containerView,
    );
  }
}
export default ReactNativeModal;
