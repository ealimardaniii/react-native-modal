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
      return {isVisible: true, showContent: false};
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
    setTimeout(() => {
      if (this.state.isSwipeable && this.state.pan) {
        this.state.pan.setValue({x: 0, y: 0});
      }
    }, 150);
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
      {margin: this.getDeviceWidth() * 0.05},
      styles.content,
      style,
    ];
    const isHiddenPhase = this.state.isVisible && !this.state.showContent;
    const initialHiddenStyle = isHiddenPhase
      ? {transform: [{translateY: this.getDeviceHeight()}]} // برای slideInUp
      : null;
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
        style: [panPosition, computedStyle, initialHiddenStyle],
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
