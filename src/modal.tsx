import * as React from 'react';
import {
  BackHandler,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  EmitterSubscription,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  PanResponderGestureState,
  PanResponderInstance,
  Platform,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
  StyleProp,
  ViewProps,
} from 'react-native';
import {CustomAnimation, Animation} from 'react-native-animatable';

import {
  buildAnimations,
  initializeAnimations,
  reversePercentage,
} from './utils';
import styles from './modal.style';
import {
  Direction,
  GestureResponderEvent,
  OnOrientationChange,
  Orientation,
  OrNull,
  PresentationStyle,
} from './types';
import * as animatable from 'react-native-animatable';

initializeAnimations();

export type OnSwipeCompleteParams = {
  swipingDirection: Direction;
};

type State = {
  showContent: boolean;
  isVisible: boolean;
  deviceWidth: number;
  deviceHeight: number;
  isSwipeable: boolean;
  pan: OrNull<Animated.ValueXY>;
};

const defaultProps = {
  animationIn: 'slideInUp' as Animation | CustomAnimation,
  animationInTiming: 300,
  animationOut: 'slideOutDown' as Animation | CustomAnimation,
  animationOutTiming: 300,
  avoidKeyboard: false,
  coverScreen: true,
  hasBackdrop: true,
  backdropColor: 'black',
  backdropOpacity: 0.7,
  backdropTransitionInTiming: 300,
  backdropTransitionOutTiming: 300,
  customBackdrop: null as React.ReactNode,
  useNativeDriver: false,
  deviceHeight: null as OrNull<number>,
  deviceWidth: null as OrNull<number>,
  hideModalContentWhileAnimating: false,
  propagateSwipe: false as
    | boolean
    | ((
        event: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => boolean),
  isVisible: false,
  panResponderThreshold: 4,
  swipeThreshold: 100,

  onModalShow: (() => null) as () => void,
  onModalWillShow: (() => null) as () => void,
  onModalHide: (() => null) as () => void,
  onModalWillHide: (() => null) as () => void,
  onBackdropPress: (() => null) as () => void,
  onBackButtonPress: (() => null) as () => void,
  scrollTo: null as OrNull<(e: any) => void>,
  scrollOffset: 0,
  scrollOffsetMax: 0,
  scrollHorizontal: false,
  statusBarTranslucent: false,
  supportedOrientations: ['portrait', 'landscape'] as Orientation[],
};

export type ModalProps = ViewProps & {
  children: React.ReactNode;
  onSwipeStart?: (gestureState: PanResponderGestureState) => void;
  onSwipeMove?: (
    percentageShown: number,
    gestureState: PanResponderGestureState,
  ) => void;
  onSwipeComplete?: (
    params: OnSwipeCompleteParams,
    gestureState: PanResponderGestureState,
  ) => void;
  onSwipeCancel?: (gestureState: PanResponderGestureState) => void;
  style?: StyleProp<ViewStyle>;
  swipeDirection?: Direction | Array<Direction>;
  onDismiss?: () => void;
  onShow?: () => void;
  hardwareAccelerated?: boolean;
  onOrientationChange?: OnOrientationChange;
  presentationStyle?: PresentationStyle;

  // Default ModalProps Provided
  useNativeDriverForBackdrop?: boolean;
} & typeof defaultProps;

const extractAnimationFromProps = (props: ModalProps) => ({
  animationIn: props.animationIn,
  animationOut: props.animationOut,
});

export class ReactNativeModal extends React.Component<ModalProps, State> {
  static defaultProps = defaultProps;

  backdropAnimatedOpacity: Animated.Value = new Animated.Value(0);

  backHandler: {remove: () => void} | null = null;

  isTransitioning = false;
  inSwipeClosingState = false;
  // currentSwipingDirection: SwipeDirection | null = null;
  currentSwipingDirection: OrNull<Direction> = null;

  animationIn!: string;
  animationOut!: string;

  contentRef: any;

  panResponder: PanResponderInstance | null = null;
  didUpdateDimensionsEmitter: EmitterSubscription | null = null;
  interactionHandle: number | null = null;

  constructor(props: ModalProps) {
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

    const initial = props.isVisible ? props.backdropOpacity! : 0;
    this.backdropAnimatedOpacity = new Animated.Value(initial);
  }

  static getDerivedStateFromProps(nextProps: ModalProps, state: State) {
    if (!state.isVisible && nextProps.isVisible) {
      return {isVisible: true, showContent: true};
    }
    return null;
  }

  componentDidMount() {
    if ((this.props as any).onSwipe) {
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

  componentDidUpdate(prevProps: ModalProps) {
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

  shouldPropagateSwipe = (evt: any, gestureState: PanResponderGestureState) => {
    return typeof this.props.propagateSwipe === 'function'
      ? this.props.propagateSwipe(evt, gestureState)
      : this.props.propagateSwipe;
  };

  buildPanResponder = () => {
    let animEvt: any = null;

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

      onStartShouldSetPanResponder: (e: any, gestureState) => {
        const hasScrollableView =
          e?._dispatchInstances &&
          e._dispatchInstances.some((instance: any) =>
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
          if ((this.props as any).onSwipe) {
            this.inSwipeClosingState = true;
            (this.props as any).onSwipe();
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

  getAccDistancePerDirection = (gestureState: PanResponderGestureState) => {
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

  getSwipingDirection = (gestureState: PanResponderGestureState) => {
    if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
      return gestureState.dx > 0 ? 'right' : 'left';
    }
    return gestureState.dy > 0 ? 'down' : 'up';
  };

  calcDistancePercentage = (gestureState: PanResponderGestureState) => {
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

  isDirectionIncluded = (direction: Direction) => {
    return Array.isArray(this.props.swipeDirection)
      ? this.props.swipeDirection.includes(direction)
      : this.props.swipeDirection === direction;
  };

  isSwipeDirectionAllowed = ({dy, dx}: PanResponderGestureState) => {
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

  private onOpenDone = () => {
    this.isTransitioning = false;

    if (this.interactionHandle) {
      InteractionManager.clearInteractionHandle(this.interactionHandle);
      this.interactionHandle = null;
    }

    if (!this.props.isVisible) this.close();
    else this.props.onModalShow?.();
  };

  open = () => {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    Animated.timing(this.backdropAnimatedOpacity, {
      toValue: this.props.backdropOpacity ?? 0.7,
      duration: this.props.backdropTransitionInTiming ?? 300,
      useNativeDriver: true,
    }).start();

    if (this.state.isSwipeable && this.state.pan) {
      this.state.pan.setValue({x: 0, y: 0});
    }
    this.currentSwipingDirection = null;
    this.inSwipeClosingState = false;

    if (!this.contentRef) return;

    this.props.onModalWillShow?.();
    if (this.interactionHandle == null) {
      this.interactionHandle = InteractionManager.createInteractionHandle();
    }

    if (!this.state.showContent) {
      this.setState({showContent: true}, () => {
        this.contentRef
          .animate(this.animationIn, this.props.animationInTiming ?? 300)
          .then(this.onOpenDone);
      });
      return;
    }

    this.contentRef
      .animate(this.animationIn, this.props.animationInTiming ?? 300)
      .then(this.onOpenDone);
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
  };

  makeBackdrop = () => {
    if (!this.props.hasBackdrop) return null;

    const {customBackdrop, onBackdropPress} = this.props;
    const hasCustomBackdrop = !!customBackdrop;

    const backdropWrapper = (
      <Animated.View
        style={[
          styles.backdrop,
          {
            width: this.getDeviceWidth(),
            height: this.getDeviceHeight(),
            backgroundColor: !hasCustomBackdrop
              ? this.props.backdropColor
              : 'transparent',
            opacity: this.backdropAnimatedOpacity,
          },
        ]}>
        {hasCustomBackdrop && customBackdrop}
      </Animated.View>
    );

    if (hasCustomBackdrop) return backdropWrapper;

    return (
      <TouchableWithoutFeedback onPress={onBackdropPress}>
        {backdropWrapper}
      </TouchableWithoutFeedback>
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

    let panHandlers: any = {};
    let panPosition: any = {};

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
      !this.state.showContent ? (
        <animatable.View />
      ) : (
        children
      );

    const containerView = (
      <animatable.View
        {...panHandlers}
        ref={(ref: any) => (this.contentRef = ref)}
        style={[panPosition, computedStyle]}
        pointerEvents="box-none"
        useNativeDriver={useNativeDriver}
        {...otherProps}>
        {_children}
      </animatable.View>
    );

    if (!coverScreen && this.state.isVisible) {
      return (
        <View
          pointerEvents="box-none"
          style={[styles.backdrop, styles.containerBox]}>
          {this.makeBackdrop()}
          {containerView}
        </View>
      );
    }

    return (
      <Modal
        transparent
        animationType="none"
        visible={this.state.isVisible}
        onRequestClose={onBackButtonPress}
        {...otherProps}>
        {this.makeBackdrop()}
        {avoidKeyboard ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
            style={(computedStyle as any).concat([{margin: 0}])}>
            {containerView}
          </KeyboardAvoidingView>
        ) : (
          containerView
        )}
      </Modal>
    );
  }
}

export default ReactNativeModal;
